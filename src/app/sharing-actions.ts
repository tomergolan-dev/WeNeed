"use server";

import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirectTo } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { invites, listMembers, lists, placeMembers, places, users } from "@/db/schema";
import type { ActionError } from "@/app/actions";
import { getCurrentPlace, getCurrentUser, setCurrentPlace } from "@/lib/auth";
import { normalizeEmail } from "@/lib/email";
import { canSendInvite, getInvite, sendInviteEmail } from "@/lib/invites";
import { findList, isPlaceAdmin } from "@/lib/list-access";

export type SharingError = ActionError | "invalidEmail" | "alreadyMember" | "tooMany" | "lastAdmin" | "deliveryFailed";
export type SharingResult = { ok: true; added?: boolean } | { ok: false; error: SharingError };

const ok = { ok: true } as const;
const fail = (error: SharingError): SharingResult => ({ ok: false, error });
const uuid = z.uuid();

/**
 * Invites an email address to a place, or to some of its lists. Only admins
 * invite. Someone already in a shared place is added to the lists right away;
 * everyone else gets an email and accepts in the app.
 */
async function invite(userId: string, placeId: string, emailInput: string, listIds: string[] | null): Promise<SharingResult> {
  const email = normalizeEmail(emailInput);
  if (!email) return fail("invalidEmail");
  if (!(await isPlaceAdmin(userId, placeId))) return fail("unauthorized");

  const [place] = await db.select().from(places).where(eq(places.id, placeId));
  if (!place) return fail("notFound");
  // A personal area is shared list by list, never as a whole.
  if (place.personalOwnerId && listIds === null) return fail("invalid");
  if (listIds) {
    if (listIds.length === 0 || listIds.some((id) => !uuid.safeParse(id).success)) return fail("invalid");
    const found = await db
      .select({ id: lists.id })
      .from(lists)
      .where(and(eq(lists.placeId, placeId), inArray(lists.id, listIds)));
    if (found.length !== listIds.length) return fail("notFound");
  }

  const [existing] = await db
    .select({ id: users.id, member: placeMembers.allLists })
    .from(users)
    .leftJoin(placeMembers, and(eq(placeMembers.userId, users.id), eq(placeMembers.placeId, placeId)))
    .where(eq(users.email, email));
  if (existing?.id === userId) return fail("alreadyMember");
  if (existing && existing.member !== null) {
    // Already in the place: nothing to accept, just open the lists to them.
    if (listIds === null || existing.member) return fail("alreadyMember");
    await db
      .insert(listMembers)
      .values(listIds.map((listId) => ({ listId, userId: existing.id })))
      .onConflictDoNothing();
    refresh();
    return { ok: true, added: true };
  }

  // One pending invite per address and place; a new one widens it.
  const [pending] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.placeId, placeId), eq(invites.email, email), eq(invites.status, "pending")));
  let inviteId: string;
  if (pending) {
    const merged = pending.listIds === null || listIds === null ? null : [...new Set([...pending.listIds, ...listIds])];
    await db.update(invites).set({ listIds: merged, invitedBy: userId }).where(eq(invites.id, pending.id));
    inviteId = pending.id;
  } else {
    if (!(await canSendInvite(userId))) return fail("tooMany");
    const [created] = await db
      .insert(invites)
      .values({ placeId, email, invitedBy: userId, listIds })
      .returning({ id: invites.id });
    inviteId = created.id;
  }

  const [t, [me], named] = await Promise.all([
    getTranslations("InviteEmail"),
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)),
    listIds
      ? db.select({ name: lists.name }).from(lists).where(inArray(lists.id, listIds))
      : Promise.resolve([]),
  ]);
  const what =
    listIds === null
      ? t("toPlace", { place: place.name })
      : named.length === 1
        ? t("toList", { list: named[0].name })
        : t("toLists", { count: named.length });
  try {
    await sendInviteEmail({ email, inviteId, from: me?.name ?? "", what });
  } catch (error) {
    console.error("[invite] email failed", error);
    refresh();
    return fail("deliveryFailed");
  }
  refresh();
  return ok;
}

/** From the members page: invite to the current place, or to some of its lists. */
export async function inviteToPlace(email: string, listIds: string[] | null): Promise<SharingResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const { place } = await getCurrentPlace(user.id);
  return invite(user.id, place.id, email, listIds);
}

/** From "who sees this list": invite someone to this list only. */
export async function inviteToList(listId: string, email: string): Promise<SharingResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");
  return invite(user.id, list.placeId, email, [list.id]);
}

export async function cancelInvite(inviteId: string): Promise<SharingResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!uuid.safeParse(inviteId).success) return fail("notFound");
  const [row] = await db.select({ placeId: invites.placeId }).from(invites).where(eq(invites.id, inviteId));
  if (!row) return fail("notFound");
  if (!(await isPlaceAdmin(user.id, row.placeId))) return fail("unauthorized");

  await db
    .update(invites)
    .set({ status: "canceled", respondedAt: new Date() })
    .where(and(eq(invites.id, inviteId), eq(invites.status, "pending")));
  refresh();
  return ok;
}

/** Accepts or declines an invite sent to the user's email address. */
export async function respondToInvite(inviteId: string, accept: boolean): Promise<SharingResult> {
  const user = await getCurrentUser();
  if (!user?.email) return fail("unauthorized");
  if (!uuid.safeParse(inviteId).success) return fail("notFound");
  const invite = await getInvite(inviteId, user.email);
  if (!invite) return fail("notFound");

  await db
    .update(invites)
    .set({ status: accept ? "accepted" : "declined", respondedAt: new Date() })
    .where(eq(invites.id, invite.id));
  if (!accept) {
    refresh();
    return ok;
  }

  const listIds = invite.lists?.map((l) => l.id) ?? null;
  // A shared place: join it. A personal area: only the shared lists.
  if (invite.ownerName === null) {
    await db
      .insert(placeMembers)
      .values({ placeId: invite.placeId, userId: user.id, role: "member", allLists: listIds === null })
      .onConflictDoUpdate({
        target: [placeMembers.placeId, placeMembers.userId],
        set: listIds === null ? { allLists: true } : { allLists: sql`${placeMembers.allLists}` },
      });
    await setCurrentPlace(invite.placeId);
  }
  if (listIds?.length) {
    await db
      .insert(listMembers)
      .values(listIds.map((listId) => ({ listId, userId: user.id })))
      .onConflictDoNothing();
  }
  return redirectTo(listIds?.length === 1 ? `/lists/${listIds[0]}` : "/");
}

/**
 * "Who sees this list": open to the whole place, or to selected people. The
 * people are the non-admin members added to the list; admins always see it.
 * In a personal area, they are the people the list is shared with.
 */
export async function setListAccess(
  listId: string,
  visibility: "place" | "selected",
  userIds: string[],
): Promise<SharingResult> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (visibility !== "place" && visibility !== "selected") return fail("invalid");
  if (userIds.some((id) => !uuid.safeParse(id).success)) return fail("invalid");
  const list = await findList(listId, user.id);
  if (!list) return fail("notFound");
  if (!(await isPlaceAdmin(user.id, list.placeId))) return fail("unauthorized");

  const [place] = await db.select({ personal: places.personalOwnerId }).from(places).where(eq(places.id, list.placeId));
  await db.update(lists).set({ visibility: place?.personal ? "place" : visibility }).where(eq(lists.id, list.id));
  // Only people already on the list or in the place can be added here; new people are invited.
  const allowed = userIds.length
    ? await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            inArray(users.id, userIds),
            sql`(exists (select 1 from ${placeMembers} pm where pm.place_id = ${list.placeId} and pm.user_id = ${users.id})
              or exists (select 1 from ${listMembers} lm where lm.list_id = ${list.id} and lm.user_id = ${users.id}))`,
          ),
        )
    : [];
  const keep = allowed.map((a) => a.id);
  await db
    .delete(listMembers)
    .where(and(eq(listMembers.listId, list.id), keep.length ? notInArray(listMembers.userId, keep) : undefined));
  if (keep.length) {
    await db
      .insert(listMembers)
      .values(keep.map((userId) => ({ listId: list.id, userId })))
      .onConflictDoNothing();
  }
  refresh();
  return ok;
}

async function adminContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { place } = await getCurrentPlace(user.id);
  if (place.personal || place.role !== "owner") return null;
  return { user, place };
}

async function otherAdmins(placeId: string, userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(placeMembers)
    .where(and(eq(placeMembers.placeId, placeId), eq(placeMembers.role, "owner"), ne(placeMembers.userId, userId)));
  return row?.count ?? 0;
}

/** Makes a member an admin or a regular member. A place keeps at least one admin. */
export async function setMemberRole(userId: string, role: "owner" | "member"): Promise<SharingResult> {
  const context = await adminContext();
  if (!context) return fail("unauthorized");
  if (!uuid.safeParse(userId).success || (role !== "owner" && role !== "member")) return fail("invalid");
  if (role === "member" && (await otherAdmins(context.place.id, userId)) === 0) return fail("lastAdmin");

  // An admin sees every list, so promoting someone opens all lists to them.
  await db
    .update(placeMembers)
    .set(role === "owner" ? { role, allLists: true } : { role })
    .where(and(eq(placeMembers.placeId, context.place.id), eq(placeMembers.userId, userId)));
  refresh();
  return ok;
}

/** Removes a member from the current place and from its lists. */
export async function removeMember(userId: string): Promise<SharingResult> {
  const context = await adminContext();
  if (!context) return fail("unauthorized");
  if (!uuid.safeParse(userId).success) return fail("invalid");
  if ((await otherAdmins(context.place.id, userId)) === 0) return fail("lastAdmin");

  await db
    .delete(listMembers)
    .where(
      and(
        eq(listMembers.userId, userId),
        inArray(listMembers.listId, db.select({ id: lists.id }).from(lists).where(eq(lists.placeId, context.place.id))),
      ),
    );
  await db
    .delete(placeMembers)
    .where(and(eq(placeMembers.placeId, context.place.id), eq(placeMembers.userId, userId)));
  refresh();
  return ok;
}
