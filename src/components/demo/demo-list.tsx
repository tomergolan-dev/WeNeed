"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Checklist } from "@/components/checklist/checklist";
import { ChoresList } from "@/components/chores/chores-list";
import { ItemDetailsProvider } from "@/components/lists/item-details";
import { ListMenu } from "@/components/lists/list-menu";
import { PageHeader } from "@/components/page-header";
import { FinishListButton } from "@/components/shopping/finish-list-button";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { Link } from "@/i18n/navigation";
import { MeProvider } from "@/components/lists/added-by";
import { itemsOf, ME, useDemo } from "./demo-store";

/** A list in the demo: the app's own list screens, on the browser's copy. */
export function DemoList() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("ListKinds");
  const tErrors = useTranslations("Errors");
  const tInvite = useTranslations("Invite");
  const { state } = useDemo();
  const list = state.lists.find((l) => l.id === id);

  if (!list) {
    return (
      <main className="flex flex-col items-center gap-4 px-5 pt-16 text-center">
        <p className="text-muted-foreground">{tErrors("notFound")}</p>
        <Link href="/demo" className="font-semibold text-accent-foreground">
          {tInvite("home")}
        </Link>
      </main>
    );
  }

  const items = itemsOf(state, list);
  const open = items.filter((item) => !item.done).length;
  const where = `⁨${state.place}⁩`;
  const subtitle = list.type === "tasks" ? `${where} · ${t("tasks.open", { count: open })}` : where;
  const counts = Object.fromEntries(items.map((item) => [item.id, (state.attachments[item.id] ?? []).length]));

  const header = (
    <PageHeader title={list.name} subtitle={subtitle} back="/demo">
      {list.type === "shopping" && <FinishListButton listId={list.id} remaining={open} />}
      <ListMenu listId={list.id} name={list.name} type={list.type} access={null} userId={ME} />
    </PageHeader>
  );

  return (
    <MeProvider value={ME}>
      <ItemDetailsProvider counts={counts}>
        {list.type === "shopping" && (
          <ShoppingList listId={list.id} header={header} items={items} people={state.people} />
        )}
        {list.type === "tasks" && <ChoresList listId={list.id} header={header} items={items} people={state.people} />}
        {list.type === "checklist" && (
          <Checklist listId={list.id} header={header} items={items} people={state.people} />
        )}
      </ItemDetailsProvider>
    </MeProvider>
  );
}
