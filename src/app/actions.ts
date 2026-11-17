"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirectTo } from "@/i18n/navigation";
import { z } from "zod";
import { db } from "@/db";
import { attachments, items, listMembers, lists, placeMembers, places, rounds } from "@/db/schema";
import { getCurrentPlace, getCurrentUser, isPlaceMember, openPersonalArea, setCurrentPlace } from "@/lib/auth";
import { deleteStoredFiles } from "@/lib/attachments";
import { CATEGORIES, DEFAULT_CATEGORY } from "@/lib/categories";
import { combineQuantities, findOpenItem } from "@/lib/items";
import { isListType, type ListType } from "@/lib/list-kinds";
import { ensureActiveRound } from "@/lib/lists";
import { canSeeList, findEditableItem, findList, guessCategory, isPlaceAdmin, nextPosition } from "@/lib/list-access";
import { isPlaceIcon } from "@/lib/place-icons";
import { normalizeEmail } from "@/lib/email";
import { endSession, startSession } from "@/lib/session";
import { requestSignInCode, verifySignInCode } from "@/lib/sign-in";

// Error codes map to messages under "Errors" in messages/he.json.
export type ActionError =
  | "unauthorized"
  | "invalid"
  | "notFound"
  | "listLocked"
  | "noPlace"
  | "aiLimit"
  | "aiFailed";
export type ActionResult = { ok: true } | { ok: false; error: ActionError };

const ok: ActionResult = { ok: true };
const fail = (error: ActionError): ActionResult => ({ ok: false, error });

const itemInput = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().positive().max(100_000).nullable(),
  unit: z.string().trim().max(30).nullable().transform((u) => u || null),
  // Left out when adding: shopping items get a guessed section.
  category: z.enum(CATEGORIES).optional(),
});
export type ItemInput = z.input<typeof itemInput>;

/** The signed-in user and the place they are looking at. */
async function getContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { place } = await getCurrentPlace(user.id);
  return { user, place };
}

export async function addItem(listId: string, input: ItemInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const parsed = itemInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");

  const round = await ensureActiveRound(list.id);

  // A product already on a shopping list gets the added quantity instead of a
  // second row. With no quantity it stays as it is; with another unit it is
  // added as its own row.
  if (list.type === "shopping") {
    const open = await db
      .select({ id: items.id, name: items.name, done: items.done, quantity: items.quantity, unit: items.unit })
      .from(items)
      .where(and(eq(items.roundId, round.id), eq(items.done, false)));
    const existing = findOpenItem(open, parsed.data.name);
    if (existing) {
      const total = combineQuantities(existing, parsed.data);
      if (total) await db.update(items).set(total).where(eq(items.id, existing.id));
      if (total || parsed.data.quantity === null) {
        refresh();
        return ok;
      }
    }
  }

  const category =
    parsed.data.category ??
    (list.type === "shopping" ? await guessCategory(list.placeId, parsed.data.name) : DEFAULT_CATEGORY);
  await db.insert(items).values({
    ...parsed.data,
    category,
    roundId: round.id,
    addedBy: user.id,
    position: nextPosition(round.id),
  });
  refresh();
  return ok;
}

/** Saves a new order for the items of a list's current round. */
export async function reorderItems(listId: string, itemIds: string[]): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const parsed = z.array(z.uuid()).min(1).max(1000).safeParse(itemIds);
  if (!parsed.success) return fail("invalid");

  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");

  const round = await ensureActiveRound(list.id);
  const ids = sql`array[${sql.join(parsed.data.map((id) => sql`${id}`), sql`, `)}]::uuid[]`;
  await db
    .update(items)
    .set({ position: sql`array_position(${ids}, ${items.id})` })
    .where(and(eq(items.roundId, round.id), sql`${items.id} = any(${ids})`));
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

  await db
    .update(items)
    .set({ ...parsed.data, category: parsed.data.category ?? DEFAULT_CATEGORY })
    .where(eq(items.id, itemId));
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

  await deleteStoredFiles({ itemIds: [item.id] });
  await db.delete(items).where(eq(items.id, itemId));
  refresh();
  return ok;
}

/**
 * Finishes the list's current round: it is locked into the list's history and
 * a new round opens. With carryOver, unbought items move on as new rows; the
 * finished round keeps its copy.
 */
export async function finishRound(listId: string, carryOver: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");
  if (list.type !== "shopping") return fail("invalid");

  const [finished] = await db
    .update(rounds)
    .set({ status: "completed", completedAt: new Date(), completedBy: user.id })
    .where(and(eq(rounds.listId, list.id), eq(rounds.status, "active")))
    .returning({ id: rounds.id });
  if (!finished) return fail("listLocked");

  const next = await ensureActiveRound(list.id);
  if (carryOver) {
    // Unbought items move to the new round with their note and attachments;
    // the copies left in the history keep only what was bought with them.
    await db.execute(sql`
      with carried as (
        select id as old_id, gen_random_uuid() as new_id, name, quantity, unit, category, assignee_id, added_by, note,
          row_number() over (order by position, created_at) as position
        from ${items}
        where round_id = ${finished.id} and done = false
      ),
      inserted as (
        insert into ${items} (id, round_id, name, quantity, unit, category, assignee_id, added_by, note, position)
        select new_id, ${next.id}, name, quantity, unit, category, assignee_id, added_by, note, position
        from carried
        returning id
      )
      update ${attachments} set item_id = carried.new_id
      from carried
      where ${attachments}.item_id = carried.old_id
    `);
  }

  refresh();
  return ok;
}

const listName = z.string().trim().min(1).max(40);

/** Creates a list in the current place and opens it. */
export async function createList(name: string, type: ListType): Promise<ActionResult> {
  const context = await getContext();
  if (!context) return fail("unauthorized");
  if (!context.place) return fail("noPlace");

  const parsed = listName.safeParse(name);
  if (!parsed.success || !isListType(type)) return fail("invalid");

  // Someone invited to some lists only sees what they create: it starts
  // with just them (and the admins), and they can open it up later.
  const limited = !context.place.allLists && context.place.role !== "owner";
  const [list] = await db
    .insert(lists)
    .values({ placeId: context.place.id, type, name: parsed.data, visibility: limited ? "selected" : "place" })
    .returning({ id: lists.id });
  if (limited) await db.insert(listMembers).values({ listId: list.id, userId: context.user.id });
  await ensureActiveRound(list.id);
  return redirectTo(`/lists/${list.id}`);
}

export async function renameList(listId: string, name: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const parsed = listName.safeParse(name);
  if (!parsed.success) return fail("invalid");

  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");

  await db.update(lists).set({ name: parsed.data }).where(eq(lists.id, list.id));
  refresh();
  return ok;
}

/**
 * Changes a list's kind. Items stay; fields the new kind doesn't use (like a
 * chore's due date) are kept but not shown.
 */
export async function setListType(listId: string, type: ListType): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!isListType(type)) return fail("invalid");

  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");

  await db.update(lists).set({ type }).where(eq(lists.id, list.id));
  refresh();
  return ok;
}

/** Checklists: checks or unchecks every item at once. */
export async function setAllDone(listId: string, done: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");

  const round = await ensureActiveRound(list.id);
  await db
    .update(items)
    .set(done ? { done: true, doneBy: user.id, doneAt: new Date() } : { done: false, doneBy: null, doneAt: null })
    .where(and(eq(items.roundId, round.id), eq(items.done, !done)));
  refresh();
  return ok;
}

/** Deletes a list with all its rounds and items. */
export async function deleteList(listId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");
  if (!(await isPlaceAdmin(user.id, list.placeId))) return fail("unauthorized");

  await deleteStoredFiles({ listId: list.id });
  await db.delete(lists).where(eq(lists.id, list.id));
  return redirectTo("/");
}

const choreInput = z.object({
  title: z.string().trim().min(1).max(200),
  assigneeId: z.uuid().nullable(),
  dueDate: z.iso.date().nullable(),
  dueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
});
export type ChoreInput = z.input<typeof choreInput>;

/** No assignee is always fine; otherwise the assignee must be able to see the list. */
async function isValidAssignee(assigneeId: string | null, listId: string) {
  return assigneeId === null || canSeeList(assigneeId, listId);
}

function choreFields({ title, assigneeId, dueDate, dueTime }: z.output<typeof choreInput>) {
  // A time only means something with a date.
  return { name: title, assigneeId, dueDate, dueTime: dueDate ? dueTime : null };
}

export async function addChore(listId: string, input: ChoreInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const parsed = choreInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");
  if (!(await isValidAssignee(parsed.data.assigneeId, list.id))) return fail("invalid");

  const round = await ensureActiveRound(list.id);
  await db.insert(items).values({
    ...choreFields(parsed.data),
    roundId: round.id,
    addedBy: user.id,
    position: nextPosition(round.id),
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
  if (!(await isValidAssignee(parsed.data.assigneeId, item.listId))) return fail("invalid");

  await db.update(items).set(choreFields(parsed.data)).where(eq(items.id, itemId));
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
  return redirectTo("/");
}

/** Renames the current shared place or changes its icon. Admins only. */
export async function updatePlace(input: PlaceInput): Promise<ActionResult> {
  const context = await getContext();
  if (!context) return fail("unauthorized");
  if (!context.place || context.place.personal) return fail("noPlace");
  if (context.place.role !== "owner") return fail("unauthorized");

  const parsed = placeInput.safeParse(input);
  if (!parsed.success) return fail("invalid");

  await db.update(places).set(parsed.data).where(eq(places.id, context.place.id));
  refresh();
  return ok;
}

export async function switchPlace(placeId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!z.uuid().safeParse(placeId).success || !(await isPlaceMember(user.id, placeId))) {
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
  await openPersonalArea(result.userId);
  return redirectTo("/");
}

export async function logOut(): Promise<void> {
  await endSession();
  return redirectTo("/login");
}
