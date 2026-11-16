import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members } from "@/db/schema";
import { CATEGORIES } from "@/lib/categories";

// A question the bot asked and is waiting for an answer to, stored on the
// member so the next message is understood in context.

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const NewItem = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.enum(CATEGORIES),
});
export type NewItem = z.infer<typeof NewItem>;

export const PendingAction = z.discriminatedUnion("type", [
  // "Milk is already on the list (2 cartons). Add 1 more, making it 3?"
  z.object({
    type: z.literal("duplicates"),
    createdAt: z.string(),
    listId: z.string(),
    items: z.array(z.object({ itemId: z.string(), name: z.string(), newQuantity: z.number() })),
  }),
  // "No active list. Open a new one and carry over cheese, oil?"
  z.object({
    type: z.literal("open_list"),
    createdAt: z.string(),
    previousListId: z.string(),
    leftovers: z.array(z.object({ id: z.string(), name: z.string() })),
    // Items from the message that triggered the question, added once the list opens.
    items: z.array(NewItem),
  }),
]);
export type PendingAction = z.infer<typeof PendingAction>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function readPending(value: unknown): PendingAction | null {
  const parsed = PendingAction.safeParse(value);
  if (!parsed.success) return null;
  if (Date.now() - Date.parse(parsed.data.createdAt) > MAX_AGE_MS) return null;
  return parsed.data;
}

export async function setPending(
  memberId: string,
  action: DistributiveOmit<PendingAction, "createdAt">,
): Promise<void> {
  await db
    .update(members)
    .set({ pendingAction: { ...action, createdAt: new Date().toISOString() } })
    .where(eq(members.id, memberId));
}

export async function clearPending(memberId: string): Promise<void> {
  await db.update(members).set({ pendingAction: null }).where(eq(members.id, memberId));
}
