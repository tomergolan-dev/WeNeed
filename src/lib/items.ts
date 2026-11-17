import { categoryOrder } from "./categories";
import { normalizeName } from "./normalize";

type Quantified = { quantity: number | null; unit: string | null };

const numberFormat = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 });

/**
 * "2 קרטונים", "3 יח׳" or "". `unitsLabel` is the word used for a bare
 * count (ItemForm.units in the messages file).
 */
export function formatQuantity({ quantity, unit }: Quantified, unitsLabel: string): string {
  if (quantity == null) return unit ?? "";
  return `${numberFormat.format(quantity)} ${unit ?? unitsLabel}`;
}

/** Groups items by store section, in store walking order. */
export function groupByCategory<T extends { category: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.category);
    if (group) group.push(item);
    else groups.set(item.category, [item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
    .map(([category, items]) => ({ category, items }));
}

/** The open item with the same name, ignoring niqqud, spacing, quotes and case. */
export function findOpenItem<T extends { name: string; done: boolean }>(items: T[], name: string) {
  const key = normalizeName(name);
  return items.find((item) => !item.done && normalizeName(item.name) === key) ?? null;
}

/**
 * The quantity after adding `added` to an item already on the list, or null
 * when nothing changes (no quantity added) or the two can't be combined
 * (different units).
 */
export function combineQuantities(existing: Quantified, added: Quantified): Quantified | null {
  if (added.quantity == null) return null;
  if (existing.quantity == null) return { quantity: added.quantity, unit: added.unit };
  if (normalizeName(existing.unit ?? "") !== normalizeName(added.unit ?? "")) return null;
  return { quantity: Math.round((existing.quantity + added.quantity) * 100) / 100, unit: existing.unit };
}
