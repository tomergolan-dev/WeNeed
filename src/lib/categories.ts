// Store sections, in the order a typical Israeli supermarket is walked.
// Hebrew labels live in messages/he.json under "Categories".
export const CATEGORIES = [
  "produce",
  "bakery",
  "dairy",
  "meat_fish",
  "deli",
  "pantry",
  "canned",
  "spices",
  "snacks",
  "drinks",
  "frozen",
  "cleaning",
  "personal_care",
  "baby",
  "home",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const DEFAULT_CATEGORY: Category = "other";

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function categoryOrder(value: string): number {
  const index = CATEGORIES.indexOf(value as Category);
  return index === -1 ? CATEGORIES.length : index;
}
