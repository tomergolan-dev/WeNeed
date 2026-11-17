"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { addItem, deleteItem, setItemDone, updateItem, type ItemInput } from "@/app/actions";
import type { Item } from "@/db/schema";
import { AddItemBar } from "@/components/lists/add-item-bar";
import { draftItem, useListItems } from "@/components/lists/use-list-items";
import { Button } from "@/components/ui/button";
import { DEFAULT_CATEGORY, isCategory } from "@/lib/categories";
import { CATEGORY_ICONS, TONES } from "@/lib/category-icons";
import { groupByCategory } from "@/lib/items";
import { cn } from "@/lib/utils";
import { emptyDraft, ItemFields, toItemInput, type ItemDraft } from "./item-fields";
import { ItemRow } from "./item-row";

export type Person = { id: string; name: string };

export function ShoppingList({
  listId,
  items,
  people,
}: {
  listId: string;
  items: Item[];
  people: Person[];
}) {
  const t = useTranslations("Shopping");
  const tItem = useTranslations("ItemForm");
  const tCategories = useTranslations("Categories");
  const { items: optimisticItems, run, error } = useListItems(items);

  const handleAdd = (input: ItemInput) =>
    run(
      { type: "add", item: draftItem({ ...input, category: input.category ?? DEFAULT_CATEGORY }) },
      () => addItem(listId, input),
    );

  const handlers = {
    onToggle: (id: string, done: boolean) =>
      run({ type: "patch", id, patch: { done } }, () => setItemDone(id, done)),
    onUpdate: (id: string, input: ItemInput) =>
      run(
        { type: "patch", id, patch: { ...input, category: input.category ?? DEFAULT_CATEGORY } },
        () => updateItem(id, input),
      ),
    onDelete: (id: string) => run({ type: "delete", id }, () => deleteItem(id)),
  };

  // Each person keeps one tone for their initial.
  const who = (id: string | null) => {
    const index = people.findIndex((person) => person.id === id);
    return index === -1 ? null : { initial: people[index].name.slice(0, 1), tone: TONES[index % TONES.length] };
  };

  const open = optimisticItems.filter((item) => !item.done);
  const bought = optimisticItems.filter((item) => item.done);
  const total = optimisticItems.length;

  return (
    <>
      <div className="flex flex-col gap-4 px-5 pt-3.5 pb-32">
        {total > 0 && (
          <div className="rounded-[18px] border bg-card px-4 py-3.5 shadow-soft">
            <p className="text-sm font-semibold">{t("progress", { done: bought.length, total })}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef1f0]">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${(bought.length / total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {total === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
              <ShoppingCart className="size-6" aria-hidden />
            </span>
            {t("empty")}
          </div>
        )}

        {groupByCategory(open).map(({ category, items }) => {
          const { icon: Icon, tone } = CATEGORY_ICONS[isCategory(category) ? category : DEFAULT_CATEGORY];
          return (
            <Section key={category} title={tCategories(category)} icon={<Icon className="size-3.5" />} tone={tone}>
              {items.map((item) => (
                <ItemRow key={item.id} item={item} who={who(item.addedBy)} {...handlers} />
              ))}
            </Section>
          );
        })}

        {bought.length > 0 && (
          <Section
            title={t("inCart", { count: bought.length })}
            icon={<ShoppingCart className="size-3.5" />}
            tone="bg-[#e4f3ec] text-[#11684b]"
          >
            {bought.map((item) => (
              <ItemRow key={item.id} item={item} who={null} {...handlers} />
            ))}
          </Section>
        )}
      </div>
      <AddItemBar
        placeholder={tItem("addPlaceholder")}
        onAdd={(name) => handleAdd({ name, quantity: null, unit: null })}
        details={{
          title: tItem("newTitle"),
          render: (close) => (
            <NewItemForm
              onAdd={(input) => {
                handleAdd(input);
                close();
              }}
            />
          ),
        }}
      />
    </>
  );
}

function Section({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold text-muted-foreground">
        <span className={cn("flex size-6 items-center justify-center rounded-full", tone)} aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      <ul className="rounded-[18px] border bg-card shadow-soft">{children}</ul>
    </section>
  );
}

function NewItemForm({ onAdd }: { onAdd: (input: ItemInput) => void }) {
  const t = useTranslations("ItemForm");
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const input = toItemInput(draft);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (input) onAdd(input);
      }}
    >
      <ItemFields draft={draft} onChange={setDraft} />
      <Button type="submit" size="xl" disabled={!input}>
        {t("add")}
      </Button>
    </form>
  );
}
