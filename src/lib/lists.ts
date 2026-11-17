import "server-only";
import { and, asc, desc, eq, gt, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, lists, placeMembers, places, rounds, users, type Item, type List } from "@/db/schema";
import { dueStatus } from "./due";

type ListType = List["type"];

export type ListSummary = {
  id: string;
  name: string;
  type: ListType;
  total: number;
  done: number;
  /** Chores lists only: open chores past or near their due time. */
  overdue: number;
  soon: number;
};

/** The place's lists with counts for their active rounds, oldest first. */
export async function getPlaceLists(placeId: string): Promise<ListSummary[]> {
  const [rows, dated] = await Promise.all([
    db
    .select({
      id: lists.id,
      name: lists.name,
      type: lists.type,
      total: sql<number>`count(${items.id})::int`,
      done: sql<number>`count(${items.id}) filter (where ${items.done})::int`,
    })
    .from(lists)
    .leftJoin(rounds, and(eq(rounds.listId, lists.id), eq(rounds.status, "active")))
    .leftJoin(items, eq(items.roundId, rounds.id))
    .where(eq(lists.placeId, placeId))
    .groupBy(lists.id)
    .orderBy(asc(lists.createdAt)),
    // Open chores with a due date; their status depends on the time now.
    db
      .select({ listId: rounds.listId, done: items.done, dueDate: items.dueDate, dueTime: items.dueTime })
      .from(items)
      .innerJoin(rounds, and(eq(rounds.id, items.roundId), eq(rounds.status, "active")))
      .innerJoin(lists, and(eq(lists.id, rounds.listId), eq(lists.type, "tasks")))
      .where(and(eq(lists.placeId, placeId), eq(items.done, false), isNotNull(items.dueDate))),
  ]);
  const now = Date.now();
  return rows.map((row) => {
    const statuses = dated.filter((d) => d.listId === row.id).map((d) => dueStatus(d, now));
    return {
      ...row,
      overdue: statuses.filter((s) => s === "overdue").length,
      soon: statuses.filter((s) => s === "soon").length,
    };
  });
}

/** A list, only if it is in the given place. */
export async function getList(placeId: string, listId: string) {
  const [list] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.placeId, placeId)));
  return list ?? null;
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

/** A finished round, only if its list is in the given place. */
export async function getCompletedRound(placeId: string, listId: string, roundId: string) {
  const [row] = await db
    .select({ round: rounds, listName: lists.name, completedByName: users.name })
    .from(rounds)
    .innerJoin(lists, eq(lists.id, rounds.listId))
    .leftJoin(users, eq(users.id, rounds.completedBy))
    .where(
      and(
        eq(rounds.id, roundId),
        eq(rounds.listId, listId),
        eq(lists.placeId, placeId),
        eq(rounds.status, "completed"),
      ),
    );
  return row ?? null;
}

/** A place with its members, in the order they joined. */
export async function getPlace(placeId: string) {
  const [place] = await db
    .select({ id: places.id, name: places.name, icon: places.icon })
    .from(places)
    .where(eq(places.id, placeId));
  const people = await db
    .select({ id: users.id, name: users.name, email: users.email, role: placeMembers.role })
    .from(placeMembers)
    .innerJoin(users, eq(users.id, placeMembers.userId))
    .where(eq(placeMembers.placeId, placeId))
    .orderBy(asc(placeMembers.joinedAt));
  return place ? { ...place, members: people } : null;
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

const DONE_CHORES_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;

/** A chores list's open chores plus those done in the last week. */
export async function getChores(listId: string): Promise<Item[]> {
  const round = await ensureActiveRound(listId);
  const since = new Date(Date.now() - DONE_CHORES_VISIBLE_MS);
  return db
    .select()
    .from(items)
    .where(and(eq(items.roundId, round.id), or(eq(items.done, false), gt(items.doneAt, since))))
    .orderBy(asc(items.createdAt));
}
