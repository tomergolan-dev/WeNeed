// Normalizes an item name for duplicate checks: no niqqud, no extra spaces,
// no quote-like characters, lower case.
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'״׳`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
