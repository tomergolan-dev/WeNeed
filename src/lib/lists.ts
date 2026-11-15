import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, lists, members, type Item, type List } from "@/db/schema";

type ListType = List["type"];

export async function getActiveList(householdId: string, type: ListType) {
  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(eq(lists.householdId, householdId), eq(lists.type, type), eq(lists.status, "active")),
    );
  return list ?? null;
}

export async function getListItems(listId: string): Promise<Item[]> {
  return db.select().from(items).where(eq(items.listId, listId)).orderBy(asc(items.createdAt));
}

/** The most recently completed list of a type, with its unbought items. */
export async function getLastCompletedList(householdId: string, type: ListType) {
  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(eq(lists.householdId, householdId), eq(lists.type, type), eq(lists.status, "completed")),
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

export async function getCompletedLists(householdId: string, type: ListType) {
  return db
    .select({
      id: lists.id,
      createdAt: lists.createdAt,
      completedAt: lists.completedAt,
      completedByName: members.name,
      total: sql<number>`count(${items.id})::int`,
      bought: sql<number>`count(${items.id}) filter (where ${items.done})::int`,
    })
    .from(lists)
    .leftJoin(members, eq(members.id, lists.completedBy))
    .leftJoin(items, eq(items.listId, lists.id))
    .where(
      and(eq(lists.householdId, householdId), eq(lists.type, type), eq(lists.status, "completed")),
    )
    .groupBy(lists.id, members.name)
    .orderBy(desc(lists.completedAt));
}

export async function getHouseholdList(householdId: string, listId: string) {
  const [row] = await db
    .select({ list: lists, completedByName: members.name })
    .from(lists)
    .leftJoin(members, eq(members.id, lists.completedBy))
    .where(and(eq(lists.id, listId), eq(lists.householdId, householdId)));
  return row ?? null;
}
