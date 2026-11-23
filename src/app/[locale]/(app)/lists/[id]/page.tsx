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
import { MeProvider } from "@/components/lists/me";
import { ItemDetailsProvider } from "@/components/lists/item-details";
import { countAttachments } from "@/lib/attachments";
import { requireUser } from "@/lib/auth";
import { getListAccess, getListPeople, isPlaceAdmin } from "@/lib/list-access";
import { ensureActiveRound, getChores, getListFor, getRoundItems } from "@/lib/lists";

export default function ListPage({ params }: PageProps<"/[locale]/lists/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List params={params} />
    </Suspense>
  );
}

async function List({ params }: Pick<PageProps<"/[locale]/lists/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const found = await getListFor(user.id, id);
  if (!found) notFound();
  const { list } = found;

  const round = await ensureActiveRound(list.id);
  const [t, tPlaces, items, people, admin] = await Promise.all([
    getTranslations("ListKinds"),
    getTranslations("Places"),
    list.type === "tasks" ? getChores(list.id) : getRoundItems(round.id),
    getListPeople(list.id, user.id),
    isPlaceAdmin(user.id, list.placeId),
  ]);
  // Only admins change who sees a list.
  const [access, counts] = await Promise.all([
    admin ? getListAccess(list.id, user.id) : null,
    countAttachments(items.map((item) => item.id)),
  ]);
  // Where the list lives: a shared place, my personal area, or someone else's.
  const where =
    found.personalOwnerId === null
      ? found.placeName
      : found.personalOwnerId === user.id
        ? tPlaces("personal")
        : tPlaces("sharedBy", { name: found.ownerName ?? "" });
  const open = items.filter((item) => !item.done).length;
  // Isolated so a Hebrew place name keeps its place in an English line, and back.
  const whereText = `\u2068${where}\u2069`;
  const subtitle = list.type === "tasks" ? `${whereText} · ${t("tasks.open", { count: open })}` : where;

  const header = (
    <PageHeader title={list.name} subtitle={subtitle}>
      {list.type === "shopping" && <FinishListButton listId={list.id} remaining={open} />}
      <ListMenu listId={list.id} name={list.name} type={list.type} access={access} userId={user.id} />
    </PageHeader>
  );

  return (
    <MeProvider value={user.id}>
      <ItemDetailsProvider counts={counts}>
        <AutoRefresh />
        {list.type === "shopping" && <ShoppingList listId={list.id} header={header} items={items} people={people} />}
        {list.type === "tasks" && <ChoresList listId={list.id} header={header} items={items} people={people} />}
        {list.type === "checklist" && <Checklist listId={list.id} header={header} items={items} people={people} />}
      </ItemDetailsProvider>
    </MeProvider>
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
