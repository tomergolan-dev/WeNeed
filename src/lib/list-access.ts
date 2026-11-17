import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { items, lists, placeMembers, rounds } from "@/db/schema";
import { guessCategoryWithAi } from "@/lib/ai/list-assistant";
import { DEFAULT_CATEGORY, isCategory, type Category } from "@/lib/categories";

const uuid = z.uuid();

/** Loads an item only if its list is in a place the user belongs to. */
export async function findEditableItem(itemId: string, userId: string) {
  if (!uuid.safeParse(itemId).success) return null;
  const [row] = await db
    .select({ id: items.id, status: rounds.status, placeId: lists.placeId })
    .from(items)
    .innerJoin(rounds, eq(rounds.id, items.roundId))
    .innerJoin(lists, eq(lists.id, rounds.listId))
    .innerJoin(placeMembers, and(eq(placeMembers.placeId, lists.placeId), eq(placeMembers.userId, userId)))
    .where(eq(items.id, itemId));
  return row ?? null;
}

/** Loads a list only if it is in a place the user belongs to. */
export async function findList(listId: string, userId: string) {
  if (!uuid.safeParse(listId).success) return null;
  const [row] = await db
    .select({ id: lists.id, placeId: lists.placeId, type: lists.type, name: lists.name })
    .from(lists)
    .innerJoin(placeMembers, and(eq(placeMembers.placeId, lists.placeId), eq(placeMembers.userId, userId)))
    .where(eq(lists.id, listId));
  return row ?? null;
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
