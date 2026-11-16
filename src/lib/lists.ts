import "server-only";
import { and, asc, desc, eq, gt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, lists, placeMembers, places, users, type Item, type List } from "@/db/schema";

type ListType = List["type"];

export async function getActiveList(placeId: string, type: ListType) {
  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(eq(lists.placeId, placeId), eq(lists.type, type), eq(lists.status, "active")),
    );
  return list ?? null;
}

export async function getListItems(listId: string): Promise<Item[]> {
  return db.select().from(items).where(eq(items.listId, listId)).orderBy(asc(items.createdAt));
}

/** The most recently completed list of a type, with its unbought items. */
export async function getLastCompletedList(placeId: string, type: ListType) {
  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(eq(lists.placeId, placeId), eq(lists.type, type), eq(lists.status, "completed")),
    )
    .orderBy(desc(lists.completedAt))
    .limit(1);
  if (!list) return null;

  const leftovers = await db
    .select({ id: items.id, name: items.name })
    .from(items)
    .where(and(eq(items.listId, list.id), eq(items.done, false)))
    .orderBy(asc(items.createdAt));
  return { list, leftovers };
}

export async function getCompletedLists(placeId: string, type: ListType) {
  return db
    .select({
      id: lists.id,
      createdAt: lists.createdAt,
      completedAt: lists.completedAt,
      completedByName: users.name,
      total: sql<number>`count(${items.id})::int`,
      bought: sql<number>`count(${items.id}) filter (where ${items.done})::int`,
    })
    .from(lists)
    .leftJoin(users, eq(users.id, lists.completedBy))
    .leftJoin(items, eq(items.listId, lists.id))
    .where(
      and(eq(lists.placeId, placeId), eq(lists.type, type), eq(lists.status, "completed")),
    )
    .groupBy(lists.id, users.name)
    .orderBy(desc(lists.completedAt));
}

export async function getPlaceList(placeId: string, listId: string) {
  const [row] = await db
    .select({ list: lists, completedByName: users.name })
    .from(lists)
    .leftJoin(users, eq(users.id, lists.completedBy))
    .where(and(eq(lists.id, listId), eq(lists.placeId, placeId)));
  return row ?? null;
}

/** A place with its members, in the order they joined. */
export async function getPlace(placeId: string) {
  const [place] = await db
    .select({ id: places.id, name: places.name, icon: places.icon })
    .from(places)
    .where(eq(places.id, placeId));
  const people = await db
    .select({ id: users.id, name: users.name, phone: users.phone, role: placeMembers.role })
    .from(placeMembers)
    .innerJoin(users, eq(users.id, placeMembers.userId))
    .where(eq(placeMembers.placeId, placeId))
    .orderBy(asc(placeMembers.joinedAt));
  return place ? { ...place, members: people } : null;
}

/** Returns the active list, opening a new empty one if there is none. */
export async function ensureActiveList(placeId: string, type: ListType) {
  const existing = await getActiveList(placeId, type);
  if (existing) return existing;
  // The partial unique index makes a concurrent open a no-op.
  await db.insert(lists).values({ placeId, type }).onConflictDoNothing();
  const created = await getActiveList(placeId, type);
  if (!created) throw new Error("Failed to open an active list");
  return created;
}

const DONE_CHORES_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;

/** Open chores plus chores done in the last week, on the ongoing tasks list. */
export async function getChores(placeId: string): Promise<Item[]> {
  const list = await getActiveList(placeId, "tasks");
  if (!list) return [];
  const since = new Date(Date.now() - DONE_CHORES_VISIBLE_MS);
  return db
    .select()
    .from(items)
    .where(and(eq(items.listId, list.id), or(eq(items.done, false), gt(items.doneAt, since))))
    .orderBy(asc(items.createdAt));
}
