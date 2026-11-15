import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { OpenListForm } from "@/components/shopping/open-list-form";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { requireMember } from "@/lib/auth";
import { getActiveList, getLastCompletedList, getListItems } from "@/lib/lists";

export default async function ShoppingPage() {
  const t = await getTranslations("Shopping");

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Suspense fallback={<ListSkeleton />}>
        <ActiveShoppingList />
      </Suspense>
    </>
  );
}

async function ActiveShoppingList() {
  const member = await requireMember();
  const list = await getActiveList(member.householdId, "shopping");

  if (!list) {
    const previous = await getLastCompletedList(member.householdId, "shopping");
    return (
      <>
        <AutoRefresh />
        <OpenListForm leftovers={previous?.leftovers.map((i) => i.name) ?? []} />
      </>
    );
  }

  const items = await getListItems(list.id);
  return (
    <>
      <AutoRefresh />
      <ShoppingList listId={list.id} items={items} />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
