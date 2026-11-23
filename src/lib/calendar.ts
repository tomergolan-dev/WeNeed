// The calendar feed: a private link a user adds once to Google Calendar or
// the iPhone calendar, which then shows their tasks and keeps updating on its
// own (Google refreshes it every few hours, the iPhone as set on the phone).
// It holds open tasks with a date that are assigned to the user, or to no one,
// in lists they can see. Tasks assigned to others stay out, so the calendar
// doesn't fill up with other people's work.

import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, gte, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { items, lists, rounds, users } from "@/db/schema";
import { dueAt } from "@/lib/due";
import { canSeeListSql } from "@/lib/list-access";

const EVENT_MS = 30 * 60 * 1000;
// Tasks overdue for longer than this are left out.
const PAST_DAYS = 60;
const MAX_EVENTS = 500;

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** The feed's address for a token, as https:// (Google) or webcal:// (the iPhone). */
export function calendarUrls(token: string) {
  const https = `${appUrl()}/api/calendar/${token}.ics`;
  const webcal = https.replace(/^https?:/, "webcal:");
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}

/** The user's token, made on first use; `fresh` replaces it, cutting off the old link. */
export async function calendarToken(userId: string, fresh = false) {
  if (!fresh) {
    const [user] = await db.select({ token: users.calendarToken }).from(users).where(eq(users.id, userId));
    if (user?.token) return user.token;
  }
  const token = randomBytes(24).toString("base64url");
  await db.update(users).set({ calendarToken: token }).where(eq(users.id, userId));
  return token;
}

/** The user whose feed this token opens, or null. */
export async function calendarOwner(token: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const [user] = await db
    .select({ id: users.id, locale: users.locale })
    .from(users)
    .where(eq(users.calendarToken, token));
  return user ?? null;
}

/** Text for an iCalendar value: backslashes, commas, semicolons and line breaks escaped. */
const escape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** Lines longer than 75 bytes go on, after a space, on the next line (RFC 5545). */
function fold(line: string) {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const utc = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const day = (date: string) => date.replace(/-/g, "");
function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
}

const shorten = (note: string | null) => {
  const text = note?.trim() ?? "";
  return text.length > 1000 ? `${text.slice(0, 1000)}…` : text;
};

/** The feed for one user, as an .ics file. */
export async function buildCalendar(user: { id: string; locale: string }) {
  const since = new Date(Date.now() - PAST_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: items.id,
      name: items.name,
      dueDate: items.dueDate,
      dueTime: items.dueTime,
      note: items.note,
      listId: lists.id,
      listName: lists.name,
    })
    .from(items)
    .innerJoin(rounds, eq(rounds.id, items.roundId))
    .innerJoin(lists, eq(lists.id, rounds.listId))
    .where(
      and(
        eq(lists.type, "tasks"),
        eq(rounds.status, "active"),
        eq(items.done, false),
        isNotNull(items.dueDate),
        gte(items.dueDate, since),
        or(eq(items.assigneeId, user.id), isNull(items.assigneeId)),
        canSeeListSql(user.id),
      ),
    )
    .orderBy(asc(items.dueDate))
    .limit(MAX_EVENTS);

  const prefix = user.locale === "en" ? "/en" : "";
  const stamp = utc(Date.now());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//We Need//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:We Need",
    "X-WR-TIMEZONE:Asia/Jerusalem",
    // A hint for how often to check for changes; calendar apps may check less often.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const row of rows) {
    const date = row.dueDate!;
    const url = `${appUrl()}${prefix}/lists/${row.listId}`;
    lines.push("BEGIN:VEVENT", `UID:${row.id}@weneed`, `DTSTAMP:${stamp}`);
    if (row.dueTime) {
      const start = dueAt(date, row.dueTime);
      lines.push(`DTSTART:${utc(start)}`, `DTEND:${utc(start + EVENT_MS)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${day(date)}`, `DTEND;VALUE=DATE:${nextDay(date)}`, "TRANSP:TRANSPARENT");
    }
    lines.push(
      `SUMMARY:${escape(row.name)}`,
      // The task's note first (shortened if long), then the list and a link to it.
      `DESCRIPTION:${escape([shorten(row.note), row.listName, url].filter(Boolean).join("\n\n"))}`,
      `URL:${url}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
