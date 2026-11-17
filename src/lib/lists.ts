import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { items, listMembers, lists, placeMembers, places, rounds, users, type Item, type List } from "@/db/schema";
import { canSeeListSql } from "./list-access";
import { DONE_TASKS_VISIBLE_MS, dueStatus } from "./due";

type ListType = List["type"];

export type ListSummary = {
  id: string;
  name: string;
  type: ListType;
  total: number;
  done: number;
  visibility: "place" | "selected";
  /** Set when the list is in someone's personal area: whose. */
  ownerName: string | null;
  /** People added to the list by name, without the user. */
  sharedWith: string[];
  /** Chores lists only: open chores past or near their due time. */
  overdue: number;
  soon: number;
};

/** The lists of a place that the user can see, with counts for their active rounds, oldest first. */
export function getPlaceLists(placeId: string, userId: string): Promise<ListSummary[]> {
  return summarizeLists(userId, and(eq(lists.placeId, placeId), canSeeListSql(userId))!);
}

/** Lists in other people's personal areas that were shared with the user. */
export function getSharedWithMe(userId: string): Promise<ListSummary[]> {
  return summarizeLists(
    userId,
    sql`exists (select 1 from ${listMembers} lm where lm.list_id = ${lists.id} and lm.user_id = ${userId})
      and exists (select 1 from ${places} p where p.id = ${lists.placeId} and p.personal_owner_id is not null and p.personal_owner_id <> ${userId})`,
  );
}

async function summarizeLists(userId: string, where: SQL): Promise<ListSummary[]> {
  const rows = await db
    .select({
      id: lists.id,
      name: lists.name,
      type: lists.type,
      visibility: lists.visibility,
      ownerName: sql<string | null>`(select u.name from ${places} p join ${users} u on u.id = p.personal_owner_id where p.id = ${lists.placeId})`,
      total: sql<number>`count(${items.id})::int`,
      done: sql<number>`count(${items.id}) filter (where ${items.done})::int`,
    })
    .from(lists)
    .leftJoin(rounds, and(eq(rounds.listId, lists.id), eq(rounds.status, "active")))
    .leftJoin(items, eq(items.roundId, rounds.id))
    .where(where)
    .groupBy(lists.id)
    .orderBy(asc(lists.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [dated, shared] = await Promise.all([
    // Open chores with a due date; their status depends on the time now.
    db
      .select({ listId: rounds.listId, done: items.done, dueDate: items.dueDate, dueTime: items.dueTime })
      .from(items)
      .innerJoin(rounds, and(eq(rounds.id, items.roundId), eq(rounds.status, "active")))
      .innerJoin(lists, and(eq(lists.id, rounds.listId), eq(lists.type, "tasks")))
      .where(and(inArray(lists.id, ids), eq(items.done, false), isNotNull(items.dueDate))),
    db
      .select({ listId: listMembers.listId, name: users.name })
      .from(listMembers)
      .innerJoin(users, eq(users.id, listMembers.userId))
      .where(and(inArray(listMembers.listId, ids), ne(listMembers.userId, userId)))
      .orderBy(asc(listMembers.addedAt)),
  ]);
  const now = Date.now();
  return rows.map((row) => {
    const statuses = dated.filter((d) => d.listId === row.id).map((d) => dueStatus(d, now));
    return {
      ...row,
      sharedWith: shared.filter((s) => s.listId === row.id).map((s) => s.name),
      overdue: statuses.filter((s) => s === "overdue").length,
      soon: statuses.filter((s) => s === "soon").length,
    };
  });
}

/** A list, only if the user can see it, with whose personal area it is in (if any). */
export async function getListFor(userId: string, listId: string) {
  const [row] = await db
    .select({ list: lists, placeName: places.name, personalOwnerId: places.personalOwnerId, ownerName: users.name })
    .from(lists)
    .innerJoin(places, eq(places.id, lists.placeId))
    .leftJoin(users, eq(users.id, places.personalOwnerId))
    .where(and(eq(lists.id, listId), canSeeListSql(userId)));
  return row ?? null;
}

/** The list's active round, opening one if there is none. */
export async function ensureActiveRound(listId: string) {
  const find = async () => {
    const [round] = await db
      .select()
      .from(rounds)
      .where(and(eq(rounds.listId, listId), eq(rounds.status, "active")));
    return round ?? null;
  };
  const existing = await find();
  if (existing) return existing;
  // The partial unique index makes a concurrent open a no-op.
  await db.insert(rounds).values({ listId }).onConflictDoNothing();
  const created = await find();
  if (!created) throw new Error("Failed to open an active round");
  return created;
}

export async function getRoundItems(roundId: string): Promise<Item[]> {
  return db
    .select()
    .from(items)
    .where(eq(items.roundId, roundId))
    .orderBy(asc(items.position), asc(items.createdAt));
}

/** Finished rounds of a list, newest first, with item counts. */
export async function getCompletedRounds(listId: string) {
  return db
    .select({
      id: rounds.id,
      createdAt: rounds.createdAt,
      completedAt: rounds.completedAt,
      completedByName: users.name,
      total: sql<number>`count(${items.id})::int`,
      bought: sql<number>`count(${items.id}) filter (where ${items.done})::int`,
    })
    .from(rounds)
    .leftJoin(users, eq(users.id, rounds.completedBy))
    .leftJoin(items, eq(items.roundId, rounds.id))
    .where(and(eq(rounds.listId, listId), eq(rounds.status, "completed")))
    .groupBy(rounds.id, users.name)
    .orderBy(desc(rounds.completedAt));
}

/** A finished round, only if the user can see its list. */
export async function getCompletedRound(userId: string, listId: string, roundId: string) {
  const [row] = await db
    .select({ round: rounds, listName: lists.name, completedByName: users.name })
    .from(rounds)
    .innerJoin(lists, eq(lists.id, rounds.listId))
    .leftJoin(users, eq(users.id, rounds.completedBy))
    .where(
      and(
        eq(rounds.id, roundId),
        eq(rounds.listId, listId),
        canSeeListSql(userId),
        eq(rounds.status, "completed"),
      ),
    );
  return row ?? null;
}

/** A place with its members, in the order they joined. */
export async function getPlace(placeId: string) {
  const [place] = await db
    .select({ id: places.id, name: places.name, icon: places.icon, personalOwnerId: places.personalOwnerId })
    .from(places)
    .where(eq(places.id, placeId));
  if (!place) return null;
  const [people, added] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: placeMembers.role,
        allLists: placeMembers.allLists,
      })
      .from(placeMembers)
      .innerJoin(users, eq(users.id, placeMembers.userId))
      .where(eq(placeMembers.placeId, placeId))
      .orderBy(asc(placeMembers.joinedAt)),
    // Lists each member was added to, for "sees: Shopping".
    db
      .select({ userId: listMembers.userId, listName: lists.name })
      .from(listMembers)
      .innerJoin(lists, eq(lists.id, listMembers.listId))
      .where(eq(lists.placeId, placeId))
      .orderBy(asc(lists.createdAt)),
  ]);
  return {
    ...place,
    members: people.map((person) => ({
      ...person,
      lists: added.filter((a) => a.userId === person.id).map((a) => a.listName),
    })),
  };
}

/**
 * The place's first list of a type, created with the given name if there is
 * none. Used by the paused bot.
 */
export async function ensureFirstList(placeId: string, type: ListType, name: string) {
  const [existing] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.placeId, placeId), eq(lists.type, type)))
    .orderBy(asc(lists.createdAt))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(lists).values({ placeId, type, name }).returning();
  return created;
}


/** A chores list's open chores plus those done in the last week. */
export async function getChores(listId: string): Promise<Item[]> {
  const round = await ensureActiveRound(listId);
  const since = new Date(Date.now() - DONE_TASKS_VISIBLE_MS);
  return db
    .select()
    .from(items)
    .where(and(eq(items.roundId, round.id), or(eq(items.done, false), gt(items.doneAt, since))))
    .orderBy(asc(items.createdAt));
}
