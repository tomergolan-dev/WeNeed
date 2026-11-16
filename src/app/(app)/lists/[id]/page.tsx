import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AutoRefresh } from "@/components/auto-refresh";
import { FinishListButton } from "@/components/shopping/finish-list-button";
import { ListMenu } from "@/components/lists/list-menu";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { PageHeader } from "@/components/page-header";
import { requirePlace } from "@/lib/auth";
import { ensureActiveRound, getList, getPlace, getRoundItems } from "@/lib/lists";

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
  if (!list || list.type !== "shopping") notFound();

  const round = await ensureActiveRound(list.id);
  const [items, details] = await Promise.all([getRoundItems(round.id), getPlace(place.id)]);
  const people = details?.members.map(({ id, name }) => ({ id, name })) ?? [];

  return (
    <>
      <AutoRefresh />
      <PageHeader title={list.name} subtitle={place.name}>
        <FinishListButton listId={list.id} remaining={items.filter((item) => !item.done).length} />
        <ListMenu listId={list.id} name={list.name} />
      </PageHeader>
      <ShoppingList listId={list.id} items={items} people={people} />
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
