import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { nameFor } from "./names";
import { invites, items, listMembers, lists, placeMembers, places, rounds, users } from "@/db/schema";
import { guessCategoryWithAi } from "@/lib/ai/list-assistant";
import { DEFAULT_CATEGORY, isCategory, type Category } from "@/lib/categories";

const uuid = z.uuid();

/**
 * SQL that is true when the user can see the list in `alias` (a lists row):
 * they were added to it, or they are a member of its place and either an
 * admin, or a member of all lists and the list is open to the whole place.
 */
export function canSeeListSql(userId: string, alias = "lists") {
  const l = sql.raw(`"${alias}"`);
  return sql`(
    exists (select 1 from ${listMembers} lm where lm.list_id = ${l}.id and lm.user_id = ${userId})
    or exists (
      select 1 from ${placeMembers} pm
      where pm.place_id = ${l}.place_id and pm.user_id = ${userId}
        and (pm.role = 'owner' or (pm.all_lists and ${l}.visibility = 'place'))
    )
  )`;
}

/** Loads a list only if the user can see it. */
export async function findList(listId: string, userId: string) {
  if (!uuid.safeParse(listId).success) return null;
  const [row] = await db
    .select({ id: lists.id, placeId: lists.placeId, type: lists.type, name: lists.name, visibility: lists.visibility })
    .from(lists)
    .where(and(eq(lists.id, listId), canSeeListSql(userId)));
  return row ?? null;
}

/** Loads an item only if the user can see its list. */
export async function findEditableItem(itemId: string, userId: string) {
  if (!uuid.safeParse(itemId).success) return null;
  const [row] = await db
    .select({ id: items.id, status: rounds.status, placeId: lists.placeId, listId: lists.id })
    .from(items)
    .innerJoin(rounds, eq(rounds.id, items.roundId))
    .innerJoin(lists, eq(lists.id, rounds.listId))
    .where(and(eq(items.id, itemId), canSeeListSql(userId)));
  return row ?? null;
}

/** Whether the user is an admin of the place (the owner of a personal area is its admin). */
export async function isPlaceAdmin(userId: string, placeId: string) {
  if (!uuid.safeParse(placeId).success) return false;
  const [row] = await db
    .select({ role: placeMembers.role })
    .from(placeMembers)
    .where(and(eq(placeMembers.placeId, placeId), eq(placeMembers.userId, userId)));
  return row?.role === "owner";
}

/** Everyone who can see the list, in the order they joined; for initials and assignees. */
export async function getListPeople(listId: string, viewerId?: string) {
  return db
    .select({ id: users.id, name: viewerId ? nameFor(viewerId) : users.name })
    .from(users)
    .innerJoin(lists, eq(lists.id, listId))
    .leftJoin(placeMembers, and(eq(placeMembers.placeId, lists.placeId), eq(placeMembers.userId, users.id)))
    .leftJoin(listMembers, and(eq(listMembers.listId, lists.id), eq(listMembers.userId, users.id)))
    .where(
      sql`${listMembers.userId} is not null or ${placeMembers.role} = 'owner' or (${placeMembers.allLists} and ${lists.visibility} = 'place')`,
    )
    .orderBy(sql`coalesce(${placeMembers.joinedAt}, ${listMembers.addedAt})`);
}

/** Whether a user can see a list; used to check a chore's assignee. */
export async function canSeeList(userId: string, listId: string) {
  return (await findList(listId, userId)) !== null;
}

/** The position after the last item in a round, so new items go last. */
export function nextPosition(roundId: string) {
  return sql<number>`(select coalesce(max(${items.position}), 0) + 1 from ${items} where ${items.roundId} = ${roundId})`;
}

/**
 * The store section for a product added by hand: the section it had the last
 * time it was bought in this place, otherwise a guess by the AI.
 */
export async function guessCategory(placeId: string, name: string): Promise<Category> {
  const [previous] = await db
    .select({ category: items.category })
    .from(items)
    .innerJoin(rounds, eq(rounds.id, items.roundId))
    .innerJoin(lists, and(eq(lists.id, rounds.listId), eq(lists.type, "shopping")))
    .where(
      and(
        eq(lists.placeId, placeId),
        ne(items.category, DEFAULT_CATEGORY),
        sql`lower(trim(${items.name})) = lower(trim(${name}))`,
      ),
    )
    .orderBy(desc(items.createdAt))
    .limit(1);
  if (previous && isCategory(previous.category)) return previous.category;

  try {
    return (await guessCategoryWithAi(name)) ?? DEFAULT_CATEGORY;
  } catch (error) {
    console.warn("[ai] category guess failed", error);
    return DEFAULT_CATEGORY;
  }
}

export type ListAccess = {
  placeName: string;
  personal: boolean;
  visibility: "place" | "selected";
  /** Place members, and for a personal area the people the list is shared with. */
  people: { id: string; name: string; role: "owner" | "member" | null; allLists: boolean; added: boolean }[];
  /** Emails invited to this list who have not answered yet. */
  pending: string[];
};

/** Everything the "who sees this list" sheet shows. */
export async function getListAccess(listId: string, viewerId: string): Promise<ListAccess | null> {
  const [list] = await db
    .select({ visibility: lists.visibility, placeId: lists.placeId, placeName: places.name, owner: places.personalOwnerId })
    .from(lists)
    .innerJoin(places, eq(places.id, lists.placeId))
    .where(eq(lists.id, listId));
  if (!list) return null;

  const [people, pending] = await Promise.all([
    db
      .select({
        id: users.id,
        name: nameFor(viewerId),
        role: placeMembers.role,
        allLists: sql<boolean>`coalesce(${placeMembers.allLists}, false)`,
        added: sql<boolean>`${listMembers.userId} is not null`,
      })
      .from(users)
      .leftJoin(placeMembers, and(eq(placeMembers.userId, users.id), eq(placeMembers.placeId, list.placeId)))
      .leftJoin(listMembers, and(eq(listMembers.userId, users.id), eq(listMembers.listId, listId)))
      .where(sql`${placeMembers.userId} is not null or ${listMembers.userId} is not null`)
      .orderBy(sql`coalesce(${placeMembers.joinedAt}, ${listMembers.addedAt})`),
    db
      .select({ email: invites.email })
      .from(invites)
      .where(and(eq(invites.placeId, list.placeId), eq(invites.status, "pending"), sql`${listId} = any(${invites.listIds})`)),
  ]);
  return {
    placeName: list.placeName,
    personal: list.owner !== null,
    visibility: list.visibility,
    people,
    pending: pending.map((p) => p.email),
  };
}
