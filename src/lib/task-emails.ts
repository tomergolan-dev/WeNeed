import "server-only";
import { and, eq, gt, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { after } from "next/server";
// The plain translator, without React: emails are built outside any page.
import { createTranslator } from "use-intl/core";
import { Resend } from "resend";
import { db } from "@/db";
import { invites, items, lists, places, rounds, signInCodes, taskEmails, users } from "@/db/schema";
import { directionOf, routing, type Locale } from "@/i18n/routing";
import { canSeeList, getListPeople } from "./list-access";
import { daysBetween, dueAt, TIME_ZONE, todayIn } from "./due";
import he from "../../messages/he.json";
import en from "../../messages/en.json";

// Emails about tasks, to the person a task is assigned to:
// - "assigned": someone else assigned it to them (sent right away);
// - "manual": someone pressed "send a reminder" on it;
// - automatic reminders, from sendDueReminders (run every 10 minutes by a
//   GitHub Actions schedule): an hour before a task with a time, and at 8:00
//   and 17:00 on the day of a task with a date only.
// Nothing is sent for done tasks, to people who turned task emails off, or to
// people who no longer see the list.

export type TaskEmailKind = (typeof taskEmails.$inferInsert)["kind"];
export type TaskEmailResult = "sent" | "skipped" | "off" | "limit" | "failed";

// Resend's free plan sends 100 emails a day, shared with sign-in codes and invites.
const MAX_EMAILS_PER_DAY = 90;
// Per person, so a "send a reminder" button can't flood an inbox.
const MAX_TASK_EMAILS_PER_USER_PER_DAY = 12;
/** A manual reminder for the same task waits this long after the last one. */
export const MANUAL_GAP_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MORNING_HOUR = 8;
const EVENING_HOUR = 17;

const MESSAGES = { he, en } as const;

async function emailsSentToday() {
  const since = sql`now() - interval '1 day'`;
  const count = (table: typeof signInCodes | typeof invites | typeof taskEmails) =>
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(table)
      .where(gt(table.createdAt, since))
      .then(([row]) => row?.n ?? 0);
  const [codes, invited, tasks] = await Promise.all([count(signInCodes), count(invites), count(taskEmails)]);
  return codes + invited + tasks;
}

async function taskEmailsTo(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(taskEmails)
    .where(and(eq(taskEmails.userId, userId), gt(taskEmails.createdAt, sql`now() - interval '1 day'`)));
  return row?.n ?? 0;
}

/** The last email of these kinds about a task to a person, if any. */
async function lastEmail(itemId: string, userId: string, kinds: TaskEmailKind[]) {
  const [row] = await db
    .select({ at: sql<Date>`max(${taskEmails.createdAt})` })
    .from(taskEmails)
    .where(and(eq(taskEmails.itemId, itemId), eq(taskEmails.userId, userId), inArray(taskEmails.kind, kinds)));
  return row?.at ? new Date(row.at).getTime() : null;
}

/** When the last manual reminder about a task went out, for the button's wait. */
export async function lastManualReminder(itemId: string) {
  const [row] = await db
    .select({ at: sql<Date>`max(${taskEmails.createdAt})` })
    .from(taskEmails)
    .where(and(eq(taskEmails.itemId, itemId), eq(taskEmails.kind, "manual")));
  return row?.at ? new Date(row.at).getTime() : null;
}

async function loadTask(itemId: string) {
  const [row] = await db
    .select({
      id: items.id,
      name: items.name,
      done: items.done,
      dueDate: items.dueDate,
      dueTime: items.dueTime,
      assigneeId: items.assigneeId,
      note: items.note,
      roundStatus: rounds.status,
      listId: lists.id,
      listName: lists.name,
      listType: lists.type,
      placeName: places.name,
      personal: isNotNull(places.personalOwnerId),
    })
    .from(items)
    .innerJoin(rounds, eq(rounds.id, items.roundId))
    .innerJoin(lists, eq(lists.id, rounds.listId))
    .innerJoin(places, eq(places.id, lists.placeId))
    .where(eq(items.id, itemId));
  return row ?? null;
}
type Task = NonNullable<Awaited<ReturnType<typeof loadTask>>>;

/**
 * The one person who sees a list, when only one does. Their unassigned tasks
 * are theirs, so they get the reminders (a list of one has no one to assign).
 */
async function soleViewer(listId: string) {
  const people = await getListPeople(listId);
  return people.length === 1 ? people[0].id : null;
}

/**
 * Sends one task email, if it should go out: the task is open and still
 * assigned to the person, they see the list, want task emails, and the daily
 * limits allow it. Automatic reminders go out once per due time.
 */
export async function sendTaskEmail(input: {
  itemId: string;
  userId: string;
  kind: TaskEmailKind;
  dueKey?: string;
  sentBy?: string;
}): Promise<TaskEmailResult> {
  const task = await loadTask(input.itemId);
  if (!task || task.listType !== "tasks" || task.roundStatus !== "active" || task.done) return "skipped";
  if (
    task.assigneeId !== input.userId &&
    !(task.assigneeId === null && (await soleViewer(task.listId)) === input.userId)
  )
    return "skipped";

  const [recipient] = await db
    .select({ email: users.email, locale: users.locale, taskEmails: users.taskEmails })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!recipient?.email) return "skipped";
  if (!recipient.taskEmails) return "off";
  if (!(await canSeeList(input.userId, task.listId))) return "skipped";

  if ((await emailsSentToday()) >= MAX_EMAILS_PER_DAY) return "limit";
  if ((await taskEmailsTo(input.userId)) >= MAX_TASK_EMAILS_PER_USER_PER_DAY) return "limit";

  let senderName: string | null = null;
  if (input.sentBy) {
    const [sender] = await db.select({ name: users.name }).from(users).where(eq(users.id, input.sentBy));
    senderName = sender?.name ?? null;
  }

  // Claim the email first, so two runs never send the same automatic reminder.
  const [claimed] = await db
    .insert(taskEmails)
    .values({
      itemId: task.id,
      userId: input.userId,
      kind: input.kind,
      dueKey: input.dueKey ?? "",
      sentBy: input.sentBy ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: taskEmails.id });
  if (!claimed) return "skipped";

  try {
    const locale: Locale = recipient.locale === "en" ? "en" : routing.defaultLocale;
    await deliver(recipient.email, locale, task, input.kind, senderName);
    return "sent";
  } catch (error) {
    console.error("[task-email] delivery failed", error);
    // Let the next run try an automatic reminder again.
    await db.delete(taskEmails).where(eq(taskEmails.id, claimed.id));
    return "failed";
  }
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// Keeps a Hebrew name in an English line (and back) in its place.
const isolate = (text: string) => `⁨${text}⁩`;

/** "היום, 17:00", "מחר", "יום ו׳, 21 בנוב׳". */
function dueText(task: Task, locale: Locale, t: (key: string) => string) {
  if (!task.dueDate) return null;
  const days = daysBetween(todayIn(), task.dueDate);
  const [y, m, d] = task.dueDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day =
    days === 0
      ? t("today")
      : days === 1
        ? t("tomorrow")
        : new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
            date,
          );
  return task.dueTime ? `${day}, ${task.dueTime.slice(0, 5)}` : day;
}

async function deliver(email: string, locale: Locale, task: Task, kind: TaskEmailKind, senderName: string | null) {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "TaskEmail" });
  const name = isolate(task.name);
  const heading =
    kind === "assigned"
      ? t("assigned", { name: isolate(senderName ?? t("someone")), task: name })
      : kind === "manual"
        ? t("manual", { name: isolate(senderName ?? t("someone")), task: name })
        : kind === "hour_before"
          ? t("hourBefore", { task: name })
          : kind === "morning"
            ? t("morning", { task: name })
            : t("evening", { task: name });
  const due = dueText(task, locale, (key) => t(key as "today"));
  const where = task.personal ? task.listName : `${task.listName} · ${task.placeName}`;
  // The task's note, shortened so a long one doesn't fill the email.
  const fullNote = task.note?.trim() ?? "";
  const note = fullNote.length > 600 ? `${fullNote.slice(0, 600)}…` : fullNote;
  // Hebrew lives at the plain addresses, English under /en.
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${prefix}/lists/${task.listId}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[task-email] to ${email}: ${heading} (${url})`);
      return;
    }
    throw new Error("RESEND_API_KEY is not set");
  }
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  // Inline styles only: email clients ignore stylesheets. Colors follow the app theme.
  const html = `<!doctype html><html lang="${locale}" dir="${directionOf(locale)}"><body style="margin:0;background:#fafbfa;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#1d2522">
<div style="max-width:440px;margin:0 auto;padding:32px 24px;text-align:center">
<p dir="ltr" style="margin:0 0 24px;font-size:16px;font-weight:800;color:#16835f">WeNeed</p>
<h1 style="margin:0 0 20px;font-size:20px;line-height:1.4">${escape(heading)}</h1>
<div style="margin:0 0 24px;padding:16px;border-radius:16px;background:#fff;border:1px solid #e6eae8;text-align:start">
<p style="margin:0;font-size:17px;font-weight:700">${escape(task.name)}</p>
${due ? `<p style="margin:6px 0 0;font-size:14px;color:#11684b">${escape(due)}</p>` : ""}
<p style="margin:6px 0 0;font-size:13px;color:#66736e">${escape(where)}</p>
${note ? `<div style="margin:12px 0 0;padding:10px 12px;border-radius:12px;background:#f3f5f4"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#66736e">${t("note")}</p><p style="margin:0;font-size:14px;line-height:1.5;white-space:pre-line">${escape(note)}</p></div>` : ""}
</div>
<a href="${url}" style="display:inline-block;padding:14px 28px;border-radius:14px;background:#16835f;color:#fff;font-size:16px;font-weight:700;text-decoration:none">${t("button")}</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#8a958f">${t("footer")}</p>
</div></body></html>`;

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email,
    subject: heading,
    html,
    text: [heading, "", task.name, due, where, "", url, "", t("footer")].filter((l) => l !== null).join("\n"),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

/**
 * After the response, emails the assignee of a task someone else just
 * assigned to them. Assigning a task to yourself sends nothing.
 */
export function notifyAssigned(itemId: string, assigneeId: string | null, actorId: string) {
  if (!assigneeId || assigneeId === actorId) return;
  after(async () => {
    await sendTaskEmail({ itemId, userId: assigneeId, kind: "assigned", sentBy: actorId });
  });
}

/** The hour of the day in Israel. */
function israelHour(now: number) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
}

/**
 * Sends the automatic reminders that are due now. Safe to run as often as
 * wanted: each reminder goes out once per due time. The windows are wide
 * (until the due time, or a few hours) since the schedule can run late.
 */
export async function sendDueReminders(now: number = Date.now()) {
  const today = todayIn(now);
  const tomorrow = todayIn(now + 24 * HOUR_MS);
  const hour = israelHour(now);

  const candidates = await db
    .select({
      id: items.id,
      assigneeId: items.assigneeId,
      listId: lists.id,
      dueDate: items.dueDate,
      dueTime: items.dueTime,
    })
    .from(items)
    .innerJoin(rounds, and(eq(rounds.id, items.roundId), eq(rounds.status, "active")))
    .innerJoin(lists, and(eq(lists.id, rounds.listId), eq(lists.type, "tasks")))
    .where(and(eq(items.done, false), gte(items.dueDate, today), lte(items.dueDate, tomorrow)));

  const results: Record<TaskEmailResult, number> = { sent: 0, skipped: 0, off: 0, limit: 0, failed: 0 };
  const sole = new Map<string, string | null>();
  for (const task of candidates) {
    if (!task.dueDate) continue;
    // Unassigned tasks go to the list's only person, if it has just one.
    if (!task.assigneeId && !sole.has(task.listId)) sole.set(task.listId, await soleViewer(task.listId));
    const recipient = task.assigneeId ?? sole.get(task.listId);
    if (!recipient) continue;
    let kind: TaskEmailKind | null = null;
    let dueKey = task.dueDate;
    if (task.dueTime) {
      const at = dueAt(task.dueDate, task.dueTime);
      if (now >= at - HOUR_MS && now < at) {
        kind = "hour_before";
        dueKey = `${task.dueDate} ${task.dueTime.slice(0, 5)}`;
      }
    } else if (task.dueDate === today) {
      if (hour >= MORNING_HOUR && hour < 12) kind = "morning";
      else if (hour >= EVENING_HOUR && hour < 23) kind = "evening";
    }
    if (!kind) continue;

    // Just told about it (assigned, or reminded by hand): no need for another email now.
    const recent = await lastEmail(task.id, recipient, ["assigned", "manual"]);
    if (recent && now - recent < HOUR_MS) continue;

    results[await sendTaskEmail({ itemId: task.id, userId: recipient, kind, dueKey })]++;
  }
  return results;
}
