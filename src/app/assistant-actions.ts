"use server";

import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { aiRequests, items, placeMembers, users } from "@/db/schema";
import type { ActionError, ActionResult } from "@/app/actions";
import { parseChecklist, parseChores, parseShopping } from "@/lib/ai/list-assistant";
import { getCurrentUser } from "@/lib/auth";
import { normalizeName } from "@/lib/normalize";
import { DEFAULT_CATEGORY } from "@/lib/categories";
import { TIME_ZONE } from "@/lib/due";
import { findEditableItem, findList } from "@/lib/list-access";
import { ensureActiveRound } from "@/lib/lists";

// Limits on AI chat messages, so open sign-up can't run up the API bill.
const DAILY_LIMIT_PER_USER = 100;
const DAILY_LIMIT_TOTAL = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

export type AssistantReply = { added: AddedItem[]; duplicates: Duplicate[]; skipped: string[] };
export type AssistantResult = { ok: true; reply: AssistantReply } | { ok: false; error: ActionError };

const message = z.string().trim().min(1).max(500);
const isoDate = z.iso.date();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Counts this message against the daily limits; false when over a limit. */
async function withinLimits(userId: string) {
  const since = new Date(Date.now() - DAY_MS);
  const [[mine], [all]] = await Promise.all([
    db
      .select({ n: count() })
      .from(aiRequests)
      .where(and(eq(aiRequests.userId, userId), gt(aiRequests.createdAt, since))),
    db.select({ n: count() }).from(aiRequests).where(gt(aiRequests.createdAt, since)),
  ]);
  if (mine.n >= DAILY_LIMIT_PER_USER || all.n >= DAILY_LIMIT_TOTAL) return false;
  await db.insert(aiRequests).values({ userId });
  return true;
}

/** Today's date, weekday and time in Israel, for dates like "tomorrow at 5". */
function israelNow() {
  const now = new Date();
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, ...options }).format(now);
  return {
    date: part({ year: "numeric", month: "2-digit", day: "2-digit" }),
    weekday: part({ weekday: "long" }),
    time: part({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}

const sameUnit = (a: string | null, b: string | null) => normalizeName(a ?? "") === normalizeName(b ?? "");

/** Reads a message written in a list's AI chat and adds what it asks for. */
export async function askAssistant(listId: string, text: string): Promise<AssistantResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsedText = message.safeParse(text);
  if (!parsedText.success) return { ok: false, error: "invalid" };

  const list = await findList(listId, user.id);
  if (!list) return { ok: false, error: "notFound" };

  if (!(await withinLimits(user.id))) return { ok: false, error: "aiLimit" };

  const round = await ensureActiveRound(list.id);
  const current = await db
    .select({ id: items.id, name: items.name, done: items.done, quantity: items.quantity, unit: items.unit })
    .from(items)
    .where(eq(items.roundId, round.id));
  const [{ last }] = await db
    .select({ last: sql<number>`coalesce(max(${items.position}), 0)::int` })
    .from(items)
    .where(eq(items.roundId, round.id));
  let position = last;

  const reply: AssistantReply = { added: [], duplicates: [], skipped: [] };
  const insert = async (values: Omit<typeof items.$inferInsert, "roundId" | "addedBy" | "position">) => {
    const [row] = await db
      .insert(items)
      .values({ ...values, roundId: round.id, addedBy: user.id, position: ++position })
      .returning({ id: items.id });
    return row.id;
  };

  try {
    if (list.type === "shopping") {
      // Products already bought ("in the cart") are added again.
      const open = current.filter((item) => !item.done);
      const result = await parseShopping(parsedText.data, open.map((item) => item.name));
      if (!result) return { ok: false, error: "aiFailed" };

      for (const item of result.items) {
        const name = item.name.trim().slice(0, 100);
        if (!name) continue;
        const quantity = item.quantity && item.quantity > 0 && item.quantity <= 100_000 ? item.quantity : null;
        const unit = item.unit?.trim().slice(0, 30) || null;
        const existing =
          item.existing && open.find((row) => normalizeName(row.name) === normalizeName(item.existing!));
        if (existing) {
          const combine =
            quantity !== null && existing.quantity !== null && sameUnit(unit, existing.unit)
              ? { newQuantity: existing.quantity + quantity, newUnit: existing.unit }
              : quantity !== null && existing.quantity === null
                ? { newQuantity: quantity, newUnit: unit }
                : { newQuantity: null, newUnit: null };
          reply.duplicates.push({
            itemId: existing.id,
            name: existing.name,
            quantity: existing.quantity,
            unit: existing.unit,
            ...combine,
          });
          continue;
        }
        const id = await insert({ name, quantity, unit, category: item.category });
        reply.added.push({ id, name, quantity, unit, dueDate: null, dueTime: null, assignee: null });
      }
    } else if (list.type === "checklist") {
      const result = await parseChecklist(parsedText.data, current.map((item) => item.name));
      if (!result) return { ok: false, error: "aiFailed" };

      for (const item of result.items) {
        const name = item.name.trim().slice(0, 100);
        if (!name) continue;
        const existing =
          item.existing && current.find((row) => normalizeName(row.name) === normalizeName(item.existing!));
        if (existing) {
          reply.skipped.push(existing.name);
          continue;
        }
        const id = await insert({ name, category: DEFAULT_CATEGORY });
        reply.added.push({ id, name, quantity: null, unit: null, dueDate: null, dueTime: null, assignee: null });
      }
    } else {
      const members = await db
        .select({ id: users.id, name: users.name })
        .from(placeMembers)
        .innerJoin(users, eq(users.id, placeMembers.userId))
        .where(eq(placeMembers.placeId, list.placeId));
      const result = await parseChores(
        parsedText.data,
        { sender: user.name, members: members.map((m) => m.name) },
        israelNow(),
      );
      if (!result) return { ok: false, error: "aiFailed" };

      for (const chore of result.chores) {
        const name = chore.title.trim().slice(0, 200);
        if (!name) continue;
        const dueDate = chore.dueDate && isoDate.safeParse(chore.dueDate).success ? chore.dueDate : null;
        const dueTime = dueDate && chore.dueTime && hhmm.safeParse(chore.dueTime).success ? chore.dueTime : null;
        const assignee = members.find((m) => m.name === chore.assignee) ?? null;
        const id = await insert({
          name,
          category: DEFAULT_CATEGORY,
          dueDate,
          dueTime: dueTime ? `${dueTime}:00` : null,
          assigneeId: assignee?.id ?? null,
        });
        reply.added.push({ id, name, quantity: null, unit: null, dueDate, dueTime, assignee: assignee?.name ?? null });
      }
    }
  } catch (error) {
    console.error("[ai] chat failed", error);
    if (reply.added.length === 0) return { ok: false, error: "aiFailed" };
  }

  refresh();
  return { ok: true, reply };
}

/** Sets an item's quantity, from the chat's "add more?" question. */
export async function setItemQuantity(itemId: string, quantity: number, unit: string | null): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsed = z
    .object({ quantity: z.number().positive().max(100_000), unit: z.string().trim().max(30).nullable() })
    .safeParse({ quantity, unit });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const item = await findEditableItem(itemId, user.id);
  if (!item) return { ok: false, error: "notFound" };
  if (item.status !== "active") return { ok: false, error: "listLocked" };

  await db
    .update(items)
    .set({ quantity: parsed.data.quantity, unit: parsed.data.unit || null })
    .where(eq(items.id, itemId));
  refresh();
  return { ok: true };
}

/** Undoes what the chat just added: removes those items from the current round. */
export async function removeAdded(listId: string, itemIds: string[]): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsed = z.array(z.uuid()).min(1).max(100).safeParse(itemIds);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const list = await findList(listId, user.id);
  if (!list) return { ok: false, error: "notFound" };

  const round = await ensureActiveRound(list.id);
  await db.delete(items).where(and(eq(items.roundId, round.id), inArray(items.id, parsed.data)));
  refresh();
  return { ok: true };
}
