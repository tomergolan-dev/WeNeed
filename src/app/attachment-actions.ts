"use server";

import { del, head } from "@vercel/blob";
import { and, count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { attachments, items } from "@/db/schema";
import type { ActionError } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import {
  ALLOWED_FILE_TYPES,
  MAX_ATTACHMENTS_PER_ITEM,
  MAX_FILE_BYTES,
  itemFolder,
} from "@/lib/attachment-rules";
import { getAttachments, type AttachmentView } from "@/lib/attachments";
import { findEditableItem } from "@/lib/list-access";

export type AttachmentError =
  ActionError | "tooManyAttachments" | "uploadFailed";
type Result<T = object> =
  ({ ok: true } & T) | { ok: false; error: AttachmentError };

const fail = (error: AttachmentError) => ({ ok: false, error }) as const;

/** Loads the item if the user can see its list. Finished rounds are read-only. */
async function editable(
  itemId: string,
  write = true,
): Promise<
  | { error: AttachmentError }
  | {
      user: { id: string };
      item: NonNullable<Awaited<ReturnType<typeof findEditableItem>>>;
    }
> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" };
  const item = await findEditableItem(itemId, user.id);
  if (!item) return { error: "notFound" };
  if (write && item.status !== "active") return { error: "listLocked" };
  return { user, item };
}

async function roomFor(itemId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(attachments)
    .where(eq(attachments.itemId, itemId));
  return (row?.n ?? 0) < MAX_ATTACHMENTS_PER_ITEM;
}

/** The note and attachments shown in an item's details. */
export async function getItemDetails(
  itemId: string,
): Promise<
  Result<{ note: string; attachments: AttachmentView[]; readOnly: boolean }>
> {
  const found = await editable(itemId, false);
  if ("error" in found) return fail(found.error);
  const [[row], list] = await Promise.all([
    db
      .select({ note: items.note })
      .from(items)
      .where(eq(items.id, found.item.id)),
    getAttachments(found.item.id),
  ]);
  return {
    ok: true,
    note: row?.note ?? "",
    attachments: list,
    readOnly: found.item.status !== "active",
  };
}

export async function setItemNote(
  itemId: string,
  note: string,
): Promise<Result> {
  const parsed = z.string().max(2000).safeParse(note);
  if (!parsed.success) return fail("invalid");
  const found = await editable(itemId);
  if ("error" in found) return fail(found.error);
  await db
    .update(items)
    .set({ note: parsed.data.trim() || null })
    .where(eq(items.id, found.item.id));
  refresh();
  return { ok: true };
}

const linkUrl = z
  .string()
  .trim()
  .max(2000)
  .transform((value) =>
    /^https?:\/\//i.test(value) ? value : `https://${value}`,
  )
  .pipe(z.url({ protocol: /^https?$/ }));

export async function addLink(
  itemId: string,
  url: string,
  title: string,
): Promise<Result<{ attachment: AttachmentView }>> {
  const parsedUrl = linkUrl.safeParse(url);
  const parsedTitle = z.string().trim().max(100).safeParse(title);
  if (!parsedUrl.success || !parsedTitle.success) return fail("invalid");
  const found = await editable(itemId);
  if ("error" in found) return fail(found.error);
  if (!(await roomFor(found.item.id))) return fail("tooManyAttachments");

  const name =
    parsedTitle.data || new URL(parsedUrl.data).hostname.replace(/^www\./, "");
  const [row] = await db
    .insert(attachments)
    .values({
      itemId: found.item.id,
      kind: "link",
      url: parsedUrl.data,
      name,
      addedBy: found.user.id,
    })
    .returning();
  refresh();
  return {
    ok: true,
    attachment: {
      id: row.id,
      kind: "link",
      name,
      url: row.url,
      contentType: null,
      size: null,
    },
  };
}

/** Records a file the browser just uploaded to the item's folder. */
export async function addFile(
  itemId: string,
  pathname: string,
  name: string,
): Promise<Result<{ attachment: AttachmentView }>> {
  const found = await editable(itemId);
  if ("error" in found) return fail(found.error);
  if (
    !pathname.startsWith(itemFolder(found.item.id)) ||
    pathname.includes("..")
  )
    return fail("invalid");

  // Trust only what the store reports about the file.
  let info;
  try {
    info = await head(pathname);
  } catch {
    return fail("uploadFailed");
  }
  if (
    !ALLOWED_FILE_TYPES.includes(info.contentType) ||
    info.size > MAX_FILE_BYTES
  ) {
    await del(pathname).catch(() => undefined);
    return fail("invalid");
  }
  if (!(await roomFor(found.item.id))) {
    await del(pathname).catch(() => undefined);
    return fail("tooManyAttachments");
  }

  const fileName =
    z.string().trim().min(1).max(200).safeParse(name).data ??
    pathname.split("/").pop()!;
  const [row] = await db
    .insert(attachments)
    .values({
      itemId: found.item.id,
      kind: "file",
      pathname,
      name: fileName,
      contentType: info.contentType,
      size: info.size,
      addedBy: found.user.id,
    })
    .onConflictDoNothing()
    .returning();
  refresh();
  return {
    ok: true,
    attachment: {
      id: row.id,
      kind: "file",
      name: fileName,
      url: null,
      contentType: info.contentType,
      size: info.size,
    },
  };
}

export async function deleteAttachment(attachmentId: string): Promise<Result> {
  if (!z.uuid().safeParse(attachmentId).success) return fail("notFound");
  const [row] = await db
    .select({ itemId: attachments.itemId, pathname: attachments.pathname })
    .from(attachments)
    .where(eq(attachments.id, attachmentId));
  if (!row) return fail("notFound");
  const found = await editable(row.itemId);
  if ("error" in found) return fail(found.error);

  if (row.pathname) {
    try {
      await del(row.pathname);
    } catch (error) {
      console.error("[attachments] could not delete file", error);
    }
  }
  await db
    .delete(attachments)
    .where(
      and(eq(attachments.id, attachmentId), eq(attachments.itemId, row.itemId)),
    );
  refresh();
  return { ok: true };
}
