// Due dates of chores are kept in Israel time; these helpers work the same on
// the server (UTC) and in the browser.

export const TIME_ZONE = "Asia/Jerusalem";

/** How long before the due time a chore counts as "due soon". */
export const SOON_MS = 24 * 60 * 60 * 1000;

/** Done tasks stay visible under "done recently" for a week. */
export const DONE_TASKS_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Israel's offset from UTC at a moment, in ms. */
function offsetAt(utcMs: number): number {
  const p = Object.fromEntries(parts.formatToParts(utcMs).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return local - Math.floor(utcMs / 1000) * 1000;
}

/** The moment a chore is due: its time that day, or the end of the day. */
export function dueAt(date: string, time: string | null): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss] = time ? time.split(":").map(Number) : [23, 59, 59];
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss ?? 0);
  // Twice, in case the guess and the real moment fall on different sides of a clock change.
  const first = guess - offsetAt(guess);
  return guess - offsetAt(first);
}

/** Today's date in Israel, as YYYY-MM-DD. */
export function todayIn(now: number = Date.now()): string {
  const p = Object.fromEntries(parts.formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Whole days from one YYYY-MM-DD date to another. */
export function daysBetween(from: string, to: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

export type DueStatus = "overdue" | "soon" | "later" | "none";

export function dueStatus(
  chore: { done: boolean; dueDate: string | null; dueTime: string | null },
  now: number = Date.now(),
): DueStatus {
  if (chore.done || !chore.dueDate) return "none";
  const at = dueAt(chore.dueDate, chore.dueTime);
  if (at < now) return "overdue";
  return at - now <= SOON_MS ? "soon" : "later";
}

/** Today's date, weekday and time in Israel, for dates like "tomorrow at 5". */
export function israelNow() {
  const now = new Date();
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, ...options }).format(now);
  return {
    date: part({ year: "numeric", month: "2-digit", day: "2-digit" }),
    weekday: part({ weekday: "long" }),
    time: part({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}
