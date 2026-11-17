import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { AutoRefresh } from "@/components/auto-refresh";
import { Checklist } from "@/components/checklist/checklist";
import { ChoresList } from "@/components/chores/chores-list";
import { FinishListButton } from "@/components/shopping/finish-list-button";
import { ListMenu } from "@/components/lists/list-menu";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { PageHeader } from "@/components/page-header";
import { requirePlace } from "@/lib/auth";
import { ensureActiveRound, getChores, getList, getPlace, getRoundItems } from "@/lib/lists";

export default function ListPage({ params }: PageProps<"/lists/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List params={params} />
    </Suspense>
  );
}

async function List({ params }: Pick<PageProps<"/lists/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { place } = await requirePlace();
  const list = await getList(place.id, id);
  if (!list) notFound();

  const round = await ensureActiveRound(list.id);
  const [t, items, details] = await Promise.all([
    getTranslations("ListKinds"),
    list.type === "tasks" ? getChores(list.id) : getRoundItems(round.id),
    getPlace(place.id),
  ]);
  const people = details?.members.map(({ id, name }) => ({ id, name })) ?? [];
  const open = items.filter((item) => !item.done).length;
  const subtitle =
    list.type === "tasks"
      ? `${place.name} · ${t("tasks.open", { count: open })}`
      : list.type === "checklist"
        ? t("checklist.subtitle")
        : place.name;

  return (
    <>
      <AutoRefresh />
      <PageHeader title={list.name} subtitle={subtitle}>
        {list.type === "shopping" && <FinishListButton listId={list.id} remaining={open} />}
        <ListMenu listId={list.id} name={list.name} type={list.type} />
      </PageHeader>
      {list.type === "shopping" && <ShoppingList listId={list.id} items={items} people={people} />}
      {list.type === "tasks" && <ChoresList listId={list.id} items={items} people={people} />}
      {list.type === "checklist" && <Checklist listId={list.id} items={items} />}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5 pt-4" aria-hidden>
      <div className="h-11 w-2/3 animate-pulse rounded-xl bg-muted" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-[18px] bg-muted" />
      ))}
    </div>
  );
}
