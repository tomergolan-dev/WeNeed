"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { addItem, deleteItem, setItemDone, updateItem, type ItemInput } from "@/app/actions";
import type { Item } from "@/db/schema";
import { AssistantBar } from "@/components/lists/assistant-bar";
import { ListTop } from "@/components/lists/list-top";
import { chipClass, QuantityStepper, QuickAdd } from "@/components/lists/quick-add";
import { draftItem, useListItems } from "@/components/lists/use-list-items";
import { CATEGORIES, DEFAULT_CATEGORY, isCategory } from "@/lib/categories";
import { CATEGORY_ICONS, TONES } from "@/lib/category-icons";
import { combineQuantities, findOpenItem, formatQuantity, groupByCategory } from "@/lib/items";
import { cn } from "@/lib/utils";
import { toItemInput, type ItemDraft } from "./item-fields";
import { ItemRow } from "./item-row";

export type Person = { id: string; name: string };

// An empty category means "find the section automatically".
const emptyDraft: ItemDraft = { name: "", quantity: "", unit: "", category: "" };

export function ShoppingList({
  listId,
  header,
  items,
  people,
}: {
  listId: string;
  header: React.ReactNode;
  items: Item[];
  people: Person[];
}) {
  const t = useTranslations("Shopping");
  const tItem = useTranslations("ItemForm");
  const tCategories = useTranslations("Categories");
  const { items: optimisticItems, run, error } = useListItems(items);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const set = (patch: Partial<ItemDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const input = toItemInput(draft);

  const [notice, setNotice] = useState<string | null>(null);

  const handleAdd = () => {
    if (!input) return;
    setDraft(emptyDraft);
    const auto = !draft.category;
    const added: ItemInput = { ...input, category: auto ? undefined : input.category };
    const call = () => addItem(listId, added);

    // Same rules as the server: a product already on the list gets the added quantity.
    const existing = findOpenItem(optimisticItems, input.name);
    if (existing) {
      const total = combineQuantities(existing, input);
      if (total) {
        setNotice(t("merged", { name: existing.name, quantity: formatQuantity(total, tItem("units")) }));
        run({ type: "patch", id: existing.id, patch: total }, call);
        return;
      }
      if (input.quantity === null) {
        setNotice(t("alreadyListed", { name: existing.name }));
        return;
      }
    }
    setNotice(null);
    // Until the server finds the section, show it where the same product already is.
    const known = optimisticItems.find((item) => item.name.trim() === input.name)?.category;
    run(
      { type: "add", item: draftItem({ ...input, category: auto ? (known ?? DEFAULT_CATEGORY) : input.category }) },
      call,
    );
  };

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
      <ListTop header={header}>
        <QuickAdd
          placeholder={t("quickAddPlaceholder")}
          value={draft.name}
          onChange={(name) => {
            set({ name });
            setNotice(null);
          }}
          canSubmit={input !== null}
          onSubmit={handleAdd}
          notice={notice}
          options={
            <>
              <QuantityStepper value={draft.quantity} onChange={(quantity) => set({ quantity })} />
              <input
                value={draft.unit}
                onChange={(e) => set({ unit: e.target.value })}
                placeholder={tItem("unit")}
                aria-label={tItem("unit")}
                maxLength={30}
                className={`${chipClass} w-24 placeholder:text-muted-foreground`}
              />
              <select
                value={draft.category}
                onChange={(e) => set({ category: e.target.value })}
                aria-label={tItem("category")}
                className={`${chipClass} appearance-none pe-3`}
              >
                <option value="">{t("autoCategory")}</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {tCategories(category)}
                  </option>
                ))}
              </select>
            </>
          }
        />
      </ListTop>
      <div className="flex flex-col gap-4 px-5 pt-3.5 pb-40">
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
      <AssistantBar listId={listId} placeholder={t("aiPlaceholder")} />
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
