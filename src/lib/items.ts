import { categoryOrder } from "./categories";

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
