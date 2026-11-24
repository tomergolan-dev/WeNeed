"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/app/actions";
import type { Item } from "@/db/schema";
import { newId } from "@/lib/new-id";

export type ItemChange =
  | { type: "add"; item: Item }
  | { type: "patch"; id: string; patch: Partial<Item> }
  | { type: "all"; done: boolean }
  | { type: "order"; ids: string[] }
  | { type: "delete"; id: string }
  | { type: "deleteMany"; ids: string[] };

function reduce(items: Item[], change: ItemChange): Item[] {
  switch (change.type) {
    case "add":
      return [...items, change.item];
    case "patch":
      return items.map((item) => (item.id === change.id ? { ...item, ...change.patch } : item));
    case "all":
      return items.map((item) => ({ ...item, done: change.done }));
    case "delete":
      return items.filter((item) => item.id !== change.id);
    case "deleteMany": {
      const gone = new Set(change.ids);
      return items.filter((item) => !gone.has(item.id));
    }
    case "order": {
      const rank = new Map(change.ids.map((id, i) => [id, i]));
      const last = change.ids.length;
      return [...items].sort((a, b) => (rank.get(a.id) ?? last) - (rank.get(b.id) ?? last));
    }
  }
}

/** A new item shown right away, until the server confirms it. */
export function draftItem(fields: Partial<Item> & { name: string }): Item {
  return {
    id: `draft-${newId()}`,
    roundId: "",
    note: null,
    quantity: null,
    unit: null,
    category: "other",
    assigneeId: null,
    done: false,
    doneBy: null,
    doneAt: null,
    addedBy: null,
    dueDate: null,
    dueTime: null,
    position: Number.MAX_SAFE_INTEGER,
    createdAt: new Date(),
    ...fields,
  };
}

export function isDraft(item: Item) {
  return item.id.startsWith("draft-");
}

/**
 * A list's items with optimistic changes: `run` shows the change at once,
 * calls the server action, and shows an error if it fails.
 */
export function useListItems(items: Item[]) {
  const tErrors = useTranslations("Errors");
  const [optimistic, apply] = useOptimistic(items, reduce);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (change: ItemChange, call: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null);
      apply(change);
      try {
        const result = await call();
        if (!result.ok) setError(tErrors(result.error));
      } catch {
        setError(tErrors("generic"));
      }
    });

  return { items: optimistic, run, error };
}
