"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { households, items, lists } from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import { CATEGORIES, DEFAULT_CATEGORY } from "@/lib/categories";
import { consumeLoginToken } from "@/lib/login-tokens";
import { getActiveList, getLastCompletedList } from "@/lib/lists";
import { endSession, startSession } from "@/lib/session";

// Error codes map to messages under "Errors" in messages/he.json.
export type ActionError = "unauthorized" | "invalid" | "notFound" | "listLocked" | "noActiveList";
export type ActionResult = { ok: true } | { ok: false; error: ActionError };

const ok: ActionResult = { ok: true };
const fail = (error: ActionError): ActionResult => ({ ok: false, error });

const itemInput = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().positive().max(100_000).nullable(),
  unit: z.string().trim().max(30).nullable().transform((u) => u || null),
  category: z.enum(CATEGORIES).default(DEFAULT_CATEGORY),
});
export type ItemInput = z.input<typeof itemInput>;

const uuid = z.uuid();

/** Loads an item only if it belongs to the member's household and its list is active. */
async function findEditableItem(itemId: string, householdId: string) {
  if (!uuid.safeParse(itemId).success) return null;
  const [row] = await db
    .select({ id: items.id, status: lists.status })
    .from(items)
    .innerJoin(lists, eq(lists.id, items.listId))
    .where(and(eq(items.id, itemId), eq(lists.householdId, householdId)));
  return row ?? null;
}

export async function addItem(input: ItemInput): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return fail("unauthorized");

  const parsed = itemInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const list = await getActiveList(member.householdId, "shopping");
  if (!list) return fail("noActiveList");

  await db.insert(items).values({ ...parsed.data, listId: list.id, addedBy: member.id });
  refresh();
  return ok;
}

export async function updateItem(itemId: string, input: ItemInput): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return fail("unauthorized");

  const parsed = itemInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const item = await findEditableItem(itemId, member.householdId);
  if (!item) return fail("notFound");
  if (item.status !== "active") return fail("listLocked");

  await db.update(items).set(parsed.data).where(eq(items.id, itemId));
  refresh();
  return ok;
}

export async function setItemDone(itemId: string, done: boolean): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return fail("unauthorized");

  const item = await findEditableItem(itemId, member.householdId);
  if (!item) return fail("notFound");
  if (item.status !== "active") return fail("listLocked");

  await db
    .update(items)
    .set(
      done
        ? { done: true, doneBy: member.id, doneAt: new Date() }
        : { done: false, doneBy: null, doneAt: null },
    )
    .where(eq(items.id, itemId));
  refresh();
  return ok;
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return fail("unauthorized");

  const item = await findEditableItem(itemId, member.householdId);
  if (!item) return fail("notFound");
  if (item.status !== "active") return fail("listLocked");

  await db.delete(items).where(eq(items.id, itemId));
  refresh();
  return ok;
}

export async function finishList(listId: string): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return fail("unauthorized");
  if (!uuid.safeParse(listId).success) return fail("notFound");

  const [finished] = await db
    .update(lists)
    .set({ status: "completed", completedAt: new Date(), completedBy: member.id })
    .where(
      and(
        eq(lists.id, listId),
        eq(lists.householdId, member.householdId),
        eq(lists.status, "active"),
      ),
    )
    .returning({ id: lists.id });
  if (!finished) return fail("listLocked");

  refresh();
  return ok;
}

/**
 * Opens a new shopping list. With carryOver, unbought items from the last
 * finished list are copied as new rows; the finished list stays untouched.
 */
export async function openList(carryOver: boolean): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return fail("unauthorized");

  const previous = carryOver
    ? await getLastCompletedList(member.householdId, "shopping")
    : null;

  // The partial unique index guarantees a single active list, so a
  // concurrent second open simply does nothing.
  const [list] = await db
    .insert(lists)
    .values({ householdId: member.householdId, type: "shopping" })
    .onConflictDoNothing()
    .returning({ id: lists.id });

  if (list && previous && previous.leftovers.length > 0) {
    await db.execute(sql`
      insert into ${items} (list_id, name, quantity, unit, category, assignee_id, added_by)
      select ${list.id}, name, quantity, unit, category, assignee_id, added_by
      from ${items}
      where list_id = ${previous.list.id} and done = false
      order by created_at
    `);
  }

  refresh();
  return ok;
}

const householdName = z.string().trim().min(1).max(60);

export async function renameHousehold(name: string): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return fail("unauthorized");

  const parsed = householdName.safeParse(name);
  if (!parsed.success) return fail("invalid");

  await db
    .update(households)
    .set({ name: parsed.data })
    .where(eq(households.id, member.householdId));
  refresh();
  return ok;
}

export async function logIn(token: string): Promise<{ ok: false }> {
  const memberId = await consumeLoginToken(token);
  if (!memberId) return { ok: false };

  await startSession(memberId);
  redirect("/");
}

export async function logOut(): Promise<void> {
  await endSession();
  redirect("/login");
}
