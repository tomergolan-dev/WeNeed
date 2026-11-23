import "server-only";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { invites, items, listMembers, lists, places, rounds, users } from "@/db/schema";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { directionOf } from "@/i18n/routing";

export type InviteView = {
  id: string;
  placeId: string;
  placeName: string;
  /** Set when the place is someone's personal area: whose. */
  ownerName: string | null;
  invitedByName: string | null;
  /** Null for an invite to the whole place. */
  lists: { id: string; name: string; type: "shopping" | "tasks" | "checklist" }[] | null;
  email: string;
  createdAt: Date;
};

const inviteFields = {
  id: invites.id,
  placeId: invites.placeId,
  placeName: places.name,
  ownerName: sql<string | null>`(select u.name from ${users} u where u.id = ${places.personalOwnerId})`,
  invitedByName: users.name,
  listIds: invites.listIds,
  email: invites.email,
  createdAt: invites.createdAt,
};

async function withLists(rows: (Omit<InviteView, "lists"> & { listIds: string[] | null })[]): Promise<InviteView[]> {
  const ids = rows.flatMap((row) => row.listIds ?? []);
  const found = ids.length
    ? await db
        .select({ id: lists.id, name: lists.name, type: lists.type })
        .from(lists)
        .where(inArray(lists.id, ids))
        .orderBy(asc(lists.createdAt))
    : [];
  return rows.map(({ listIds, ...row }) => ({
    ...row,
    lists: listIds === null ? null : found.filter((list) => listIds.includes(list.id)),
  }));
}

/** Pending invites sent to an email address, newest first. */
export async function getInvitesFor(email: string): Promise<InviteView[]> {
  const rows = await db
    .select(inviteFields)
    .from(invites)
    .innerJoin(places, eq(places.id, invites.placeId))
    .leftJoin(users, eq(users.id, invites.invitedBy))
    .where(and(eq(invites.email, email), eq(invites.status, "pending")))
    .orderBy(desc(invites.createdAt));
  return withLists(rows);
}

/** Pending invites of a place, newest first. */
export async function getPlaceInvites(placeId: string): Promise<InviteView[]> {
  const rows = await db
    .select(inviteFields)
    .from(invites)
    .innerJoin(places, eq(places.id, invites.placeId))
    .leftJoin(users, eq(users.id, invites.invitedBy))
    .where(and(eq(invites.placeId, placeId), eq(invites.status, "pending")))
    .orderBy(desc(invites.createdAt));
  return withLists(rows);
}

/** A pending invite, only for the address it was sent to. */
export async function getInvite(id: string, email: string) {
  const [invite] = (await getInvitesFor(email)).filter((i) => i.id === id);
  return invite ?? null;
}

/** Open items in a list's active round, for the invite card. */
export async function countOpenItems(listId: string) {
  const [row] = await db
    .select({ open: sql<number>`count(*)::int` })
    .from(items)
    .innerJoin(rounds, and(eq(rounds.id, items.roundId), eq(rounds.status, "active")))
    .where(and(eq(rounds.listId, listId), eq(items.done, false)));
  return row?.open ?? 0;
}

/** Names of the people already on a list, for the invite card. */
export async function getListMemberNames(listId: string) {
  const rows = await db
    .select({ name: users.name })
    .from(listMembers)
    .innerJoin(users, eq(users.id, listMembers.userId))
    .where(eq(listMembers.listId, listId));
  return rows.map((r) => r.name);
}

const MAX_INVITES_PER_DAY = 30;

/** Whether the user may send another invite email today. */
export async function canSendInvite(userId: string) {
  const [row] = await db
    .select({ sent: sql<number>`count(*)::int` })
    .from(invites)
    .where(and(eq(invites.invitedBy, userId), gt(invites.createdAt, sql`now() - interval '1 day'`)));
  return (row?.sent ?? 0) < MAX_INVITES_PER_DAY;
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Emails an invite through Resend. Without RESEND_API_KEY in development,
 * the link is printed to the server log instead. The email and the link are
 * in the inviter's language.
 */
export async function sendInviteEmail(input: { email: string; inviteId: string; from: string; what: string }) {
  const locale = await getLocale();
  const t = await getTranslations("InviteEmail");
  const path = getPathname({ href: `/invites/${input.inviteId}`, locale });
  const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[invite] for ${input.email}: ${url}`);
      return;
    }
    throw new Error("RESEND_API_KEY is not set");
  }
  const sender = process.env.EMAIL_FROM;
  if (!sender) throw new Error("EMAIL_FROM is not set");

  const heading = t("heading", { name: input.from, what: input.what });
  const html = `<!doctype html><html lang="${locale}" dir="${directionOf(locale)}"><body style="margin:0;background:#fafbfa;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#1d2522">
<div dir="${directionOf(locale)}" style="max-width:440px;margin:0 auto;padding:32px 24px;text-align:center">
<p dir="ltr" style="margin:0 0 24px;font-size:16px;font-weight:800;color:#16835f">WeNeed</p>
<h1 style="margin:0 0 12px;font-size:20px">${escape(heading)}</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#66736e">${t("body")}</p>
<a href="${url}" style="display:inline-block;padding:14px 28px;border-radius:14px;background:#16835f;color:#fff;font-size:16px;font-weight:700;text-decoration:none">${t("button")}</a>
<p style="margin:24px 0 0;font-size:12px;color:#8a958f">${t("footer")}</p>
</div></body></html>`;

  const { error } = await new Resend(apiKey).emails.send({
    from: sender,
    to: input.email,
    subject: heading,
    html,
    text: `${heading}\n\n${t("body")}\n${url}\n\n${t("footer")}`,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
