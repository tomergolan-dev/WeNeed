"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { items, lists, placeMembers, places } from "@/db/schema";
import { getCurrentPlace, getCurrentUser, isPlaceMember, setCurrentPlace } from "@/lib/auth";
import { CATEGORIES, DEFAULT_CATEGORY } from "@/lib/categories";
import { ensureActiveList, getActiveList, getLastCompletedList } from "@/lib/lists";
import { isPlaceIcon } from "@/lib/place-icons";
import { normalizeEmail } from "@/lib/email";
import { endSession, startSession } from "@/lib/session";
import { requestSignInCode, verifySignInCode } from "@/lib/sign-in";

// Error codes map to messages under "Errors" in messages/he.json.
export type ActionError = "unauthorized" | "invalid" | "notFound" | "listLocked" | "noActiveList" | "noPlace";
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

/** The signed-in user and the place they are looking at. */
async function getContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { place } = await getCurrentPlace(user.id);
  return { user, place };
}

/** Loads an item only if its list is in a place the user belongs to. */
async function findEditableItem(itemId: string, userId: string) {
  if (!uuid.safeParse(itemId).success) return null;
  const [row] = await db
    .select({ id: items.id, status: lists.status, placeId: lists.placeId })
    .from(items)
    .innerJoin(lists, eq(lists.id, items.listId))
    .innerJoin(placeMembers, and(eq(placeMembers.placeId, lists.placeId), eq(placeMembers.userId, userId)))
    .where(eq(items.id, itemId));
  return row ?? null;
}

export async function addItem(input: ItemInput): Promise<ActionResult> {
  const context = await getContext();
  if (!context) return fail("unauthorized");
  if (!context.place) return fail("noPlace");

  const parsed = itemInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const list = await getActiveList(context.place.id, "shopping");
  if (!list) return fail("noActiveList");

  await db.insert(items).values({ ...parsed.data, listId: list.id, addedBy: context.user.id });
  refresh();
  return ok;
}

export async function updateItem(itemId: string, input: ItemInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const parsed = itemInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const item = await findEditableItem(itemId, user.id);
  if (!item) return fail("notFound");
  if (item.status !== "active") return fail("listLocked");

  await db.update(items).set(parsed.data).where(eq(items.id, itemId));
  refresh();
  return ok;
}

export async function setItemDone(itemId: string, done: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const item = await findEditableItem(itemId, user.id);
  if (!item) return fail("notFound");
  if (item.status !== "active") return fail("listLocked");

  await db
    .update(items)
    .set(
      done
        ? { done: true, doneBy: user.id, doneAt: new Date() }
        : { done: false, doneBy: null, doneAt: null },
    )
    .where(eq(items.id, itemId));
  refresh();
  return ok;
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const item = await findEditableItem(itemId, user.id);
  if (!item) return fail("notFound");
  if (item.status !== "active") return fail("listLocked");

  await db.delete(items).where(eq(items.id, itemId));
  refresh();
  return ok;
}

export async function finishList(listId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!uuid.safeParse(listId).success) return fail("notFound");

  const [list] = await db.select({ placeId: lists.placeId }).from(lists).where(eq(lists.id, listId));
  if (!list || !(await isPlaceMember(user.id, list.placeId))) return fail("notFound");

  const [finished] = await db
    .update(lists)
    .set({ status: "completed", completedAt: new Date(), completedBy: user.id })
    .where(and(eq(lists.id, listId), eq(lists.status, "active")))
    .returning({ id: lists.id });
  if (!finished) return fail("listLocked");

  refresh();
  return ok;
}

/**
 * Opens a new shopping list in the current place. With carryOver, unbought
 * items from the last finished list are copied as new rows; the finished list
 * stays untouched.
 */
export async function openList(carryOver: boolean): Promise<ActionResult> {
  const context = await getContext();
  if (!context) return fail("unauthorized");
  if (!context.place) return fail("noPlace");
  const placeId = context.place.id;

  const previous = carryOver ? await getLastCompletedList(placeId, "shopping") : null;

  // The partial unique index guarantees a single active list, so a
  // concurrent second open simply does nothing.
  const [list] = await db
    .insert(lists)
    .values({ placeId, type: "shopping" })
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

const choreInput = z.object({
  title: z.string().trim().min(1).max(200),
  assigneeId: z.uuid().nullable(),
});
export type ChoreInput = z.input<typeof choreInput>;

/** No assignee is always fine; otherwise the assignee must belong to the place. */
async function isValidAssignee(assigneeId: string | null, placeId: string) {
  return assigneeId === null || isPlaceMember(assigneeId, placeId);
}

/** Chores live on one ongoing "tasks" list per place, opened on first use. */
export async function addChore(input: ChoreInput): Promise<ActionResult> {
  const context = await getContext();
  if (!context) return fail("unauthorized");
  if (!context.place) return fail("noPlace");

  const parsed = choreInput.safeParse(input);
  if (!parsed.success) return fail("invalid");
  if (!(await isValidAssignee(parsed.data.assigneeId, context.place.id))) return fail("invalid");

  const list = await ensureActiveList(context.place.id, "tasks");
  await db.insert(items).values({
    listId: list.id,
    name: parsed.data.title,
    assigneeId: parsed.data.assigneeId,
    addedBy: context.user.id,
  });
  refresh();
  return ok;
}

export async function updateChore(itemId: string, input: ChoreInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const parsed = choreInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const item = await findEditableItem(itemId, user.id);
  if (!item) return fail("notFound");
  if (item.status !== "active") return fail("listLocked");
  if (!(await isValidAssignee(parsed.data.assigneeId, item.placeId))) return fail("invalid");

  await db
    .update(items)
    .set({ name: parsed.data.title, assigneeId: parsed.data.assigneeId })
    .where(eq(items.id, itemId));
  refresh();
  return ok;
}

const placeInput = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().refine(isPlaceIcon),
});
export type PlaceInput = z.input<typeof placeInput>;

/** Creates a place owned by the user and switches to it. */
export async function createPlace(input: PlaceInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const parsed = placeInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const [place] = await db.insert(places).values(parsed.data).returning({ id: places.id });
  await db.insert(placeMembers).values({ placeId: place.id, userId: user.id, role: "owner" });
  await setCurrentPlace(place.id);
  redirect("/");
}

/** Renames the current place or changes its icon. Any member may do this. */
export async function updatePlace(input: PlaceInput): Promise<ActionResult> {
  const context = await getContext();
  if (!context) return fail("unauthorized");
  if (!context.place) return fail("noPlace");

  const parsed = placeInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  await db.update(places).set(parsed.data).where(eq(places.id, context.place.id));
  refresh();
  return ok;
}

export async function switchPlace(placeId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!uuid.safeParse(placeId).success || !(await isPlaceMember(user.id, placeId))) {
    return fail("notFound");
  }

  await setCurrentPlace(placeId);
  refresh();
  return ok;
}

// Sign-in: an email address, then a one-time code sent to it.

export type SignInError = "invalidEmail" | "tooMany" | "busy" | "deliveryFailed" | "wrongCode" | "expired";

export async function requestCode(
  emailInput: string,
): Promise<{ ok: true; email: string } | { ok: false; error: SignInError }> {
  const email = normalizeEmail(emailInput);
  if (!email) return { ok: false, error: "invalidEmail" };

  const result = await requestSignInCode(email);
  return result === "sent" ? { ok: true, email } : { ok: false, error: result };
}

export async function verifyCode(email: string, code: string): Promise<{ ok: false; error: SignInError }> {
  const normalized = normalizeEmail(email);
  if (!normalized || !/^\d{6}$/.test(code.trim())) return { ok: false, error: "wrongCode" };

  const result = await verifySignInCode(normalized, code);
  if (!result.ok) return result;

  await startSession(result.userId);
  redirect("/");
}

export async function logOut(): Promise<void> {
  await endSession();
  redirect("/login");
}
