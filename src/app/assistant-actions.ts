"use server";

import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { aiRequests, items } from "@/db/schema";
import type { ActionError, ActionResult } from "@/app/actions";
import { parseChecklist, parseChores, parseShopping } from "@/lib/ai/list-assistant";
import { getCurrentUser } from "@/lib/auth";
import { planChecklist, planChores, planShopping, type AssistantReply, type Plan } from "@/lib/assistant-plan";
import { israelNow } from "@/lib/due";
import { findEditableItem, findList, getListPeople } from "@/lib/list-access";
import { ensureActiveRound } from "@/lib/lists";

// Limits on AI chat messages, so open sign-up can't run up the API bill.
const DAILY_LIMIT_PER_USER = 100;
const DAILY_LIMIT_TOTAL = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AssistantResult = { ok: true; reply: AssistantReply } | { ok: false; error: ActionError };

const message = z.string().trim().min(1).max(500);

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
    let plan: Plan;
    if (list.type === "shopping") {
      // Products already bought ("in the cart") are added again.
      const open = current.filter((item) => !item.done);
      const result = await parseShopping(parsedText.data, open.map((item) => item.name));
      if (!result) return { ok: false, error: "aiFailed" };
      plan = planShopping(result, open);
    } else if (list.type === "checklist") {
      const result = await parseChecklist(parsedText.data, current.map((item) => item.name));
      if (!result) return { ok: false, error: "aiFailed" };
      plan = planChecklist(result, current);
    } else {
      const members = await getListPeople(list.id);
      const result = await parseChores(
        parsedText.data,
        { sender: user.name, members: members.map((m) => m.name) },
        israelNow(),
      );
      if (!result) return { ok: false, error: "aiFailed" };
      plan = planChores(result, members);
    }

    reply.duplicates = plan.duplicates;
    reply.skipped = plan.skipped;
    for (const item of plan.add) {
      const id = await insert({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        dueDate: item.dueDate,
        dueTime: item.dueTime ? `${item.dueTime}:00` : null,
        assigneeId: item.assigneeId,
      });
      reply.added.push({
        id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        dueDate: item.dueDate,
        dueTime: item.dueTime,
        assignee: item.assignee,
      });
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
