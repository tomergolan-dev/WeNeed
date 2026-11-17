// What the AI chat does with a parsed message: which items to add, which are
// already on the list, and what the reply shows. Pure, so the app (writing to
// the database) and the demo (writing to the browser) follow the same rules.
import { z } from "zod";
import type { ChecklistParse, ChoresParse, ShoppingParse } from "@/lib/ai/list-assistant";
import { DEFAULT_CATEGORY } from "@/lib/categories";
import { combineQuantities } from "@/lib/items";
import { normalizeName } from "@/lib/normalize";

/** An item the chat added, with what the reply shows about it. */
export type AddedItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  dueDate: string | null;
  dueTime: string | null;
  assignee: string | null;
};

/**
 * A product already on the list. When the quantities can be combined,
 * `newQuantity` is the suggested total (in `newUnit`).
 */
export type Duplicate = {
  itemId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  newQuantity: number | null;
  newUnit: string | null;
};

export type AssistantReply = { added: AddedItem[]; duplicates: Duplicate[]; skipped: string[] };

/** An item to add; `dueTime` is "HH:MM". */
export type PlannedItem = Omit<AddedItem, "id"> & { category: string; assigneeId: string | null };

export type Plan = { add: PlannedItem[]; duplicates: Duplicate[]; skipped: string[] };

type Existing = { id: string; name: string; quantity: number | null; unit: string | null };

const isoDate = z.iso.date();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const blank = { quantity: null, unit: null, dueDate: null, dueTime: null, assignee: null, assigneeId: null };

/** Shopping: new products are added; ones still open on the list become "add more?" questions. */
export function planShopping(result: ShoppingParse, open: Existing[]): Plan {
  const plan: Plan = { add: [], duplicates: [], skipped: [] };
  for (const item of result.items) {
    const name = item.name.trim().slice(0, 100);
    if (!name) continue;
    const quantity = item.quantity && item.quantity > 0 && item.quantity <= 100_000 ? item.quantity : null;
    const unit = item.unit?.trim().slice(0, 30) || null;
    const existing = item.existing && open.find((row) => normalizeName(row.name) === normalizeName(item.existing!));
    if (existing) {
      const total = combineQuantities(existing, { quantity, unit });
      plan.duplicates.push({
        itemId: existing.id,
        name: existing.name,
        quantity: existing.quantity,
        unit: existing.unit,
        newQuantity: total?.quantity ?? null,
        newUnit: total?.unit ?? null,
      });
      continue;
    }
    plan.add.push({ ...blank, name, quantity, unit, category: item.category });
  }
  return plan;
}

/** Checklist: items already on it are skipped. */
export function planChecklist(result: ChecklistParse, current: { name: string }[]): Plan {
  const plan: Plan = { add: [], duplicates: [], skipped: [] };
  for (const item of result.items) {
    const name = item.name.trim().slice(0, 100);
    if (!name) continue;
    const existing = item.existing && current.find((row) => normalizeName(row.name) === normalizeName(item.existing!));
    if (existing) {
      plan.skipped.push(existing.name);
      continue;
    }
    plan.add.push({ ...blank, name, category: DEFAULT_CATEGORY });
  }
  return plan;
}

/** Tasks: each with its date, time and assignee when the message gives them. */
export function planChores(result: ChoresParse, members: { id: string; name: string }[]): Plan {
  const plan: Plan = { add: [], duplicates: [], skipped: [] };
  for (const chore of result.chores) {
    const name = chore.title.trim().slice(0, 200);
    if (!name) continue;
    const dueDate = chore.dueDate && isoDate.safeParse(chore.dueDate).success ? chore.dueDate : null;
    const dueTime = dueDate && chore.dueTime && hhmm.safeParse(chore.dueTime).success ? chore.dueTime : null;
    const assignee = members.find((m) => m.name === chore.assignee) ?? null;
    plan.add.push({
      ...blank,
      name,
      category: DEFAULT_CATEGORY,
      dueDate,
      dueTime,
      assignee: assignee?.name ?? null,
      assigneeId: assignee?.id ?? null,
    });
  }
  return plan;
}
