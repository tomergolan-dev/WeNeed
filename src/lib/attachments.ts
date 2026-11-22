import "server-only";
import { del } from "@vercel/blob";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { attachments, items, lists, rounds } from "@/db/schema";
import { canSeeListSql } from "./list-access";

export type AttachmentView = {
  id: string;
  kind: "link" | "file";
  name: string;
  url: string | null;
  contentType: string | null;
  size: number | null;
};

/** An item's attachments, oldest first. */
export async function getAttachments(itemId: string): Promise<AttachmentView[]> {
  return db
    .select({
      id: attachments.id,
      kind: attachments.kind,
      name: attachments.name,
      url: attachments.url,
      contentType: attachments.contentType,
      size: attachments.size,
    })
    .from(attachments)
    .where(eq(attachments.itemId, itemId))
    .orderBy(asc(attachments.createdAt));
}

/** How many attachments each item has, for the paperclip on its row. */
export async function countAttachments(itemIds: string[]): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};
  const rows = await db
    .select({ itemId: attachments.itemId, count: sql<number>`count(*)::int` })
    .from(attachments)
    .where(inArray(attachments.itemId, itemIds))
    .groupBy(attachments.itemId);
  return Object.fromEntries(rows.map((r) => [r.itemId, r.count]));
}

/** A file attachment, only if the user can see its list. */
export async function findFileFor(userId: string, attachmentId: string) {
  const [row] = await db
    .select({ pathname: attachments.pathname, name: attachments.name, contentType: attachments.contentType })
    .from(attachments)
    .innerJoin(items, eq(items.id, attachments.itemId))
    .innerJoin(rounds, eq(rounds.id, items.roundId))
    .innerJoin(lists, eq(lists.id, rounds.listId))
    .where(and(eq(attachments.id, attachmentId), eq(attachments.kind, "file"), canSeeListSql(userId)));
  return row?.pathname ? { ...row, pathname: row.pathname } : null;
}

/**
 * Deletes the stored files of items or a whole list. Called before deleting
 * them, since the database rows go with a cascade but the files would stay.
 */
export async function deleteStoredFiles(scope: { itemIds: string[] } | { listId: string } | { placeId: string }) {
  if ("placeId" in scope) {
    const placeLists = await db.select({ id: lists.id }).from(lists).where(eq(lists.placeId, scope.placeId));
    for (const list of placeLists) await deleteStoredFiles({ listId: list.id });
    return;
  }
  const rows =
    "itemIds" in scope
      ? scope.itemIds.length === 0
        ? []
        : await db
            .select({ pathname: attachments.pathname })
            .from(attachments)
            .where(and(inArray(attachments.itemId, scope.itemIds), isNotNull(attachments.pathname)))
      : await db
          .select({ pathname: attachments.pathname })
          .from(attachments)
          .innerJoin(items, eq(items.id, attachments.itemId))
          .innerJoin(rounds, eq(rounds.id, items.roundId))
          .where(and(eq(rounds.listId, scope.listId), isNotNull(attachments.pathname)));
  const pathnames = rows.map((r) => r.pathname!).filter(Boolean);
  if (pathnames.length === 0) return;
  try {
    await del(pathnames);
  } catch (error) {
    // The rows still go; a leftover file is not shown anywhere.
    console.error("[attachments] could not delete files", error);
  }
}
