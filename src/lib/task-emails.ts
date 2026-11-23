import "server-only";
import { and, eq, gt, gte, inArray, isNotNull, lte, sql, type SQL } from "drizzle-orm";
import { after } from "next/server";
// The plain translator, without React: emails are built outside any page.
import { createTranslator } from "use-intl/core";
import { Resend } from "resend";
import { send } from "@vercel/queue";
import { db } from "@/db";
import { invites, items, lists, places, rounds, signInCodes, taskEmails, users } from "@/db/schema";
import { directionOf, routing, type Locale } from "@/i18n/routing";
import { canSeeList, getListPeople } from "./list-access";
import { contactName } from "./names";
import { daysBetween, dueAt, TIME_ZONE, todayIn } from "./due";
import he from "../../messages/he.json";
import en from "../../messages/en.json";

// Emails about tasks, to the person a task is assigned to:
// - "assigned": someone else assigned it to them (sent right away);
// - "manual": someone pressed "send a reminder" on it;
// - automatic reminders: an hour and a quarter of an hour before a task with
//   a time, and at 8:00 and 17:00 on the day of a task with a date only.
//   Saving a task schedules them in Vercel Queues for their exact time
//   (scheduleReminders); the queue calls /api/queues/task-reminders then,
//   which checks the task again (remindTask). The reminders cron
//   (sendDueReminders) is a backup, and schedules tasks more than the
//   queue's 7 days ahead once they come closer.
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
const QUARTER_MS = 15 * 60 * 1000;
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
    // What the recipient calls the sender, if they named them.
    senderName = (await contactName(input.userId, input.sentBy)) ?? sender?.name ?? null;
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
          : kind === "quarter_before"
            ? t("quarterBefore", { task: name })
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

type Candidate = { id: string; assigneeId: string | null; listId: string; dueDate: string | null; dueTime: string | null };

const candidateFields = {
  id: items.id,
  assigneeId: items.assigneeId,
  listId: lists.id,
  dueDate: items.dueDate,
  dueTime: items.dueTime,
};

/** Open tasks in active rounds, matching `where`. */
function candidates(where: SQL) {
  return db
    .select(candidateFields)
    .from(items)
    .innerJoin(rounds, and(eq(rounds.id, items.roundId), eq(rounds.status, "active")))
    .innerJoin(lists, and(eq(lists.id, rounds.listId), eq(lists.type, "tasks")))
    .where(and(eq(items.done, false), where));
}

/**
 * The automatic reminder due for a task at a moment, if any. The windows run
 * until the due time (or a few hours), so a late run still sends it.
 */
function reminderAt(task: Pick<Candidate, "dueDate" | "dueTime">, now: number) {
  if (!task.dueDate) return null;
  if (task.dueTime) {
    const at = dueAt(task.dueDate, task.dueTime);
    const dueKey = `${task.dueDate} ${task.dueTime.slice(0, 5)}`;
    if (now >= at - QUARTER_MS && now < at) return { kind: "quarter_before" as const, dueKey };
    if (now >= at - HOUR_MS && now < at) return { kind: "hour_before" as const, dueKey };
    return null;
  }
  if (task.dueDate !== todayIn(now)) return null;
  const hour = israelHour(now);
  if (hour >= MORNING_HOUR && hour < 12) return { kind: "morning" as const, dueKey: task.dueDate };
  if (hour >= EVENING_HOUR && hour < 23) return { kind: "evening" as const, dueKey: task.dueDate };
  return null;
}

/** The moments a task's automatic reminders are due. */
function reminderTimes(task: Pick<Candidate, "dueDate" | "dueTime">) {
  if (!task.dueDate) return [];
  if (task.dueTime) {
    const at = dueAt(task.dueDate, task.dueTime);
    return [at - HOUR_MS, at - QUARTER_MS];
  }
  return [MORNING_HOUR, EVENING_HOUR].map((hour) => dueAt(task.dueDate!, `${String(hour).padStart(2, "0")}:00:00`));
}

/** Sends a task's automatic reminder if one is due now. */
async function remind(task: Candidate, now: number, sole: Map<string, string | null>): Promise<TaskEmailResult | null> {
  const reminder = reminderAt(task, now);
  if (!reminder) return null;
  // Unassigned tasks go to the list's only person, if it has just one.
  if (!task.assigneeId && !sole.has(task.listId)) sole.set(task.listId, await soleViewer(task.listId));
  const recipient = task.assigneeId ?? sole.get(task.listId);
  if (!recipient) return null;

  // Just told about it (assigned, or reminded by hand): no need for another email now.
  // The quarter-hour reminder still goes out unless that was a few minutes ago.
  const recent = await lastEmail(task.id, recipient, ["assigned", "manual"]);
  const gap = reminder.kind === "quarter_before" ? MANUAL_GAP_MS : HOUR_MS;
  if (recent && now - recent < gap) return "skipped";

  return sendTaskEmail({ itemId: task.id, userId: recipient, kind: reminder.kind, dueKey: reminder.dueKey });
}

/** Called by the queue at a reminder's time: sends it if the task still calls for it. */
export async function remindTask(itemId: string, now: number = Date.now()) {
  const [task] = await candidates(eq(items.id, itemId));
  if (!task) return null;
  return remind(task, now, new Map());
}

// The queue keeps a delayed message for at most 7 days.
const QUEUE_MAX_MS = 7 * 24 * HOUR_MS - HOUR_MS;
const TOPIC = "task-reminders";

/**
 * Schedules a task's coming reminders in the queue, each for its exact time.
 * Safe to call again: a reminder already scheduled for the same moment is
 * dropped as a duplicate, and one for a moment the task no longer has does
 * nothing when it arrives (remindTask checks the task again).
 */
export async function scheduleReminders(task: Pick<Candidate, "id" | "dueDate" | "dueTime">, now: number = Date.now()) {
  const times = reminderTimes(task).filter((at) => at - now > 30_000 && at - now < QUEUE_MAX_MS);
  // The queue works on Vercel only (it signs in with the deployment's identity).
  if (process.env.VERCEL !== "1") {
    if (times.length) console.log(`[task-reminders] would schedule ${task.id} at`, times.map((t) => new Date(t).toISOString()));
    return;
  }
  for (const at of times) {
    // A few seconds late, so the reminder's window has surely opened.
    const delaySeconds = Math.ceil((at - now) / 1000) + 5;
    try {
      await send(
        TOPIC,
        { itemId: task.id },
        {
          delaySeconds,
          retentionSeconds: Math.min(604_800, delaySeconds + 3600),
          idempotencyKey: `${task.id}:${at}`,
        },
      );
    } catch (error) {
      // A duplicate is fine; anything else is left to the backup cron.
      if ((error as Error)?.name !== "DuplicateMessageError") console.error("[task-reminders] schedule failed", error);
    }
  }
}

/** After a task is saved: schedules its reminders, without holding up the response. */
export function planReminders(itemId: string) {
  after(async () => {
    const [task] = await candidates(eq(items.id, itemId));
    if (task) await scheduleReminders(task);
  });
}

/**
 * The reminders cron, a backup to the queue: sends the automatic reminders
 * that are due now (each goes out once per due time, so running it often is
 * safe), and schedules in the queue those of tasks due within a week, which
 * covers tasks that were saved more than the queue's 7 days ahead.
 */
export async function sendDueReminders(now: number = Date.now()) {
  const today = todayIn(now);
  const week = todayIn(now + 7 * 24 * HOUR_MS);
  const tasks = await candidates(and(gte(items.dueDate, today), lte(items.dueDate, week))!);

  const results: Record<TaskEmailResult, number> = { sent: 0, skipped: 0, off: 0, limit: 0, failed: 0 };
  const sole = new Map<string, string | null>();
  for (const task of tasks) {
    const result = await remind(task, now, sole);
    if (result) results[result]++;
    await scheduleReminders(task, now);
  }
  return results;
}
