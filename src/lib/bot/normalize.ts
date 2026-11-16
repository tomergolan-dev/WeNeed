// PAUSED (2026-11-16): part of the WhatsApp bot, which is no longer the main
// product (see "History" in docs/spec.md).
// Kept because duplicate detection will be reused by the AI chat.
// Not used by the web app yet.

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
