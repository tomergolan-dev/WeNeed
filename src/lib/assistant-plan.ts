// What the AI chat does with a parsed message: which items to add, which are
// already on the list, what to change, and what the reply shows. Pure, so the
// app (writing to the database) and the demo (writing to the browser) follow
// the same rules.
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

export type AssistantReply = {
  added: AddedItem[];
  duplicates: Duplicate[];
  skipped: string[];
  changed: Change[];
  removals: Removal[];
  notFound: string[];
};

/** An item to add; `dueTime` is "HH:MM". */
export type PlannedItem = Omit<AddedItem, "id"> & { category: string; assigneeId: string | null };

export type Plan = { add: PlannedItem[]; duplicates: Duplicate[]; skipped: string[] };

type Existing = { id: string; name: string; quantity: number | null; unit: string | null };

const isoDate = z.iso.date();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const HEBREW = /[\u0590-\u05ff]/;
const LATIN = /[a-z]/i;

/** Words of a name, without numbers and signs ("גבנצ 15%" -> ["גבנצ"]). */
const words = (name: string) =>
  normalizeName(name)
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length >= 2);

/**
 * A check on the AI's "already on the list": the two names must share a
 * word, allowing singular/plural ("עגבנייה" ~ "עגבניות"). It keeps related
 * products apart ("גבינה לבנה" vs "גבנצ 15%"). Names in different
 * languages ("milk" / "חלב") are left to the AI.
 */
export function plausiblySame(a: string, b: string) {
  const mixed =
    (HEBREW.test(a) && LATIN.test(b) && !HEBREW.test(b)) || (LATIN.test(a) && !HEBREW.test(a) && HEBREW.test(b));
  if (mixed) return true;
  const shared = (x: string, y: string) => {
    let n = 0;
    while (n < x.length && n < y.length && x[n] === y[n]) n++;
    return n >= Math.min(4, x.length, y.length);
  };
  return words(a).some((x) => words(b).some((y) => shared(x, y)));
}

const blank = { quantity: null, unit: null, dueDate: null, dueTime: null, assignee: null, assigneeId: null };

/** Shopping: new products are added; ones still open on the list become "add more?" questions. */
export function planShopping(result: ShoppingParse, open: Existing[]): Plan {
  const plan: Plan = { add: [], duplicates: [], skipped: [] };
  for (const item of result.items) {
    const name = item.name.trim().slice(0, 100);
    if (!name) continue;
    const quantity = item.quantity && item.quantity > 0 && item.quantity <= 100_000 ? item.quantity : null;
    const unit = item.unit?.trim().slice(0, 30) || null;
    const existing =
      item.existing &&
      open.find((row) => normalizeName(row.name) === normalizeName(item.existing!) && plausiblySame(name, row.name));
    if (existing) {
      // Asking again for a product on the list: with no amount, one more of
      // what is there; with a bare number, in the unit already on the list.
      const added =
        quantity === null
          ? { quantity: existing.quantity === null ? null : 1, unit: existing.unit }
          : { quantity, unit: unit ?? existing.unit };
      const total = combineQuantities(existing, added);
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
    const existing =
      item.existing &&
      current.find((row) => normalizeName(row.name) === normalizeName(item.existing!) && plausiblySame(name, row.name));
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

// ---- Changes to items already on the list ("תוריד את החלב", "קניתי לחם").

/** The fields the chat can change on an item; `dueTime` is "HH:MM". */
export type ItemFields = {
  name: string;
  done: boolean;
  quantity: number | null;
  unit: string | null;
  dueDate: string | null;
  dueTime: string | null;
  assigneeId: string | null;
};

/**
 * A change the chat made to one item: the new values, and the old ones so
 * "ביטול" can put them back. `assignee` is the new assignee's name, for the reply.
 */
export type Change = {
  itemId: string;
  name: string;
  patch: Partial<ItemFields>;
  before: Partial<ItemFields>;
  assignee?: string | null;
};

/** An item the chat asks to delete; nothing is deleted until the user says yes. */
export type Removal = { itemId: string; name: string };

export type EditPlan = { changes: Change[]; removals: Removal[]; notFound: string[] };

type Edit = {
  target: string;
  action: string;
  newName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  assignee?: string | null;
};

type CurrentRow = { id: string } & ItemFields;

/**
 * The item an edit refers to: the same name, else the only one whose name
 * contains it (or is contained in it), else the only plausible one. Among
 * several with the same name, the one the action applies to comes first.
 */
function findTarget(target: string, current: CurrentRow[], preferDone: boolean | null) {
  const wanted = normalizeName(target);
  if (!wanted) return null;
  const pick = (rows: CurrentRow[]) =>
    preferDone === null ? rows[0] : (rows.find((row) => row.done === preferDone) ?? rows[0]);
  const same = current.filter((row) => normalizeName(row.name) === wanted);
  if (same.length) return pick(same);
  const inside = current.filter((row) => {
    const name = normalizeName(row.name);
    return name.includes(wanted) || wanted.includes(name);
  });
  if (inside.length === 1) return inside[0];
  const plausible = current.filter((row) => plausiblySame(target, row.name));
  return plausible.length === 1 ? plausible[0] : null;
}

/**
 * What the chat's edits do. Unknown targets are reported, deletions wait for
 * a yes, and everything else becomes a change with the values to undo it.
 */
export function planEdits(
  edits: Edit[],
  current: CurrentRow[],
  members: { id: string; name: string }[] = [],
  today = "",
): EditPlan {
  const plan: EditPlan = { changes: [], removals: [], notFound: [] };
  const byItem = new Map<string, Change>();
  const set = (row: CurrentRow, patch: Partial<ItemFields>, assignee?: string | null) => {
    let change = byItem.get(row.id);
    if (!change) {
      change = { itemId: row.id, name: row.name, patch: {}, before: {} };
      byItem.set(row.id, change);
      plan.changes.push(change);
    }
    for (const [key, value] of Object.entries(patch) as [keyof ItemFields, never][]) {
      if (row[key] === value) continue;
      if (!(key in change.before)) (change.before as Record<string, unknown>)[key] = row[key];
      (change.patch as Record<string, unknown>)[key] = value;
    }
    if (assignee !== undefined) change.assignee = assignee;
  };

  for (const edit of edits) {
    const preferDone = edit.action === "check" ? false : edit.action === "uncheck" ? true : null;
    const row = findTarget(edit.target, current, preferDone);
    if (!row) {
      const name = edit.target.trim().slice(0, 100);
      if (name && !plan.notFound.includes(name)) plan.notFound.push(name);
      continue;
    }
    switch (edit.action) {
      case "remove":
        if (!plan.removals.some((r) => r.itemId === row.id)) plan.removals.push({ itemId: row.id, name: row.name });
        break;
      case "check":
        set(row, { done: true });
        break;
      case "uncheck":
        set(row, { done: false });
        break;
      case "rename": {
        const name = edit.newName?.trim().slice(0, 200);
        if (name) set(row, { name });
        break;
      }
      case "set_quantity": {
        const quantity = edit.quantity && edit.quantity > 0 && edit.quantity <= 100_000 ? edit.quantity : null;
        if (quantity !== null) set(row, { quantity, unit: edit.unit?.trim().slice(0, 30) || row.unit });
        break;
      }
      case "set_due": {
        const newDate = edit.dueDate && isoDate.safeParse(edit.dueDate).success ? edit.dueDate : null;
        const newTime = edit.dueTime && hhmm.safeParse(edit.dueTime).success ? edit.dueTime : null;
        if (!newDate && !newTime) break;
        const dueDate = newDate ?? row.dueDate ?? (today || null);
        if (dueDate) set(row, { dueDate, dueTime: newTime ?? row.dueTime });
        break;
      }
      case "clear_due":
        set(row, { dueDate: null, dueTime: null });
        break;
      case "assign": {
        const member = members.find((m) => m.name === edit.assignee);
        if (member) set(row, { assigneeId: member.id }, member.name);
        break;
      }
      case "unassign":
        set(row, { assigneeId: null }, null);
        break;
    }
  }
  // An item that is also being deleted shows only the deletion question.
  plan.changes = plan.changes.filter(
    (change) => Object.keys(change.patch).length > 0 && !plan.removals.some((r) => r.itemId === change.itemId),
  );
  return plan;
}
