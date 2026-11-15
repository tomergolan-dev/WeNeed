"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  addItem,
  deleteItem,
  setItemDone,
  updateItem,
  type ActionResult,
  type ItemInput,
} from "@/app/actions";
import type { Item } from "@/db/schema";
import { DEFAULT_CATEGORY } from "@/lib/categories";
import { groupByCategory } from "@/lib/items";
import { AddItemForm } from "./add-item-form";
import { FinishListButton } from "./finish-list-button";
import { ItemRow } from "./item-row";

type OptimisticAction =
  | { type: "add"; item: Item }
  | { type: "update"; id: string; input: ItemInput }
  | { type: "done"; id: string; done: boolean }
  | { type: "delete"; id: string };

function reduce(items: Item[], action: OptimisticAction): Item[] {
  switch (action.type) {
    case "add":
      return [...items, action.item];
    case "update":
      return items.map((item) =>
        item.id === action.id
          ? { ...item, ...action.input, category: action.input.category ?? item.category }
          : item,
      );
    case "done":
      return items.map((item) => (item.id === action.id ? { ...item, done: action.done } : item));
    case "delete":
      return items.filter((item) => item.id !== action.id);
  }
}

export function ShoppingList({ listId, items }: { listId: string; items: Item[] }) {
  const t = useTranslations("Shopping");
  const tCategories = useTranslations("Categories");
  const tErrors = useTranslations("Errors");
  const [optimisticItems, apply] = useOptimistic(items, reduce);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (action: OptimisticAction, call: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null);
      apply(action);
      try {
        const result = await call();
        if (!result.ok) setError(tErrors(result.error));
      } catch {
        setError(tErrors("generic"));
      }
    });

  const handleAdd = (input: ItemInput) => {
    const draft: Item = {
      id: `draft-${crypto.randomUUID()}`,
      listId,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      category: input.category ?? DEFAULT_CATEGORY,
      assigneeId: null,
      done: false,
      doneBy: null,
      doneAt: null,
      addedBy: null,
      createdAt: new Date(),
    };
    run({ type: "add", item: draft }, () => addItem(input));
  };

  const handlers = {
    onToggle: (id: string, done: boolean) =>
      run({ type: "done", id, done }, () => setItemDone(id, done)),
    onUpdate: (id: string, input: ItemInput) =>
      run({ type: "update", id, input }, () => updateItem(id, input)),
    onDelete: (id: string) => run({ type: "delete", id }, () => deleteItem(id)),
  };

  const open = optimisticItems.filter((item) => !item.done);
  const bought = optimisticItems.filter((item) => item.done);

  return (
    <div className="flex flex-col gap-6">
      <AddItemForm onAdd={handleAdd} />
      {error && <p className="text-sm text-destructive">{error}</p>}

      {optimisticItems.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
      )}

      {groupByCategory(open).map(({ category, items }) => (
        <section key={category} className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-muted-foreground">{tCategories(category)}</h2>
          <ul className="flex flex-col">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} {...handlers} />
            ))}
          </ul>
        </section>
      ))}

      {bought.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("inCart", { count: bought.length })}
          </h2>
          <ul className="flex flex-col">
            {bought.map((item) => (
              <ItemRow key={item.id} item={item} {...handlers} />
            ))}
          </ul>
        </section>
      )}

      <FinishListButton listId={listId} remaining={open.length} />
    </div>
  );
}
