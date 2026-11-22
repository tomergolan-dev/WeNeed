import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirectTo } from "@/i18n/navigation";
import { db } from "@/db";
import { lists, placeMembers, places, users } from "@/db/schema";
import { canSeeListSql } from "./list-access";
import { PERSONAL_ICON } from "./place-icons";
import { getSessionUserId } from "./session";

export type CurrentUser = { id: string; name: string; email: string | null; locale: string; taskEmails: boolean };

export type PlaceSummary = {
  id: string;
  name: string;
  icon: string;
  role: "owner" | "member";
  /** The user's personal area ("שלי"). Its name is shown from the messages file. */
  personal: boolean;
  /** False when the user was invited to some lists only. */
  allLists: boolean;
  memberCount: number;
  listCount: number;
  /** Lists in the place this user can see. */
  visibleCount: number;
};

// The place the user is looking at; any place they belong to can be chosen.
const PLACE_COOKIE = "wn_place";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, locale: users.locale, taskEmails: users.taskEmails })
    .from(users)
    .where(eq(users.id, userId));
  return user ?? null;
}

/** For pages: sends visitors without a valid session to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) return redirectTo("/login");
  // Task emails go out in the language the user last opened the app in.
  const locale = await getLocale();
  if (user.locale !== locale) {
    await db.update(users).set({ locale }).where(eq(users.id, user.id));
    user.locale = locale;
  }
  return user;
}

/**
 * The user's personal area, created on first use. Its lists are private
 * unless shared, and the user is its only member and admin.
 */
export async function ensurePersonalPlace(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: places.id, member: placeMembers.userId })
    .from(places)
    .leftJoin(placeMembers, and(eq(placeMembers.placeId, places.id), eq(placeMembers.userId, userId)))
    .where(eq(places.personalOwnerId, userId));
  let placeId = existing?.id;
  if (!placeId) {
    const [created] = await db
      .insert(places)
      .values({ name: "", icon: PERSONAL_ICON, personalOwnerId: userId })
      .onConflictDoNothing()
      .returning({ id: places.id });
    placeId =
      created?.id ??
      (await db.select({ id: places.id }).from(places).where(eq(places.personalOwnerId, userId)))[0].id;
  }
  if (!existing?.member) {
    await db.insert(placeMembers).values({ placeId, userId, role: "owner" }).onConflictDoNothing();
  }
  return placeId;
}

/** The places a user belongs to: their personal area first, then shared places in the order they joined. */
export async function getUserPlaces(userId: string): Promise<PlaceSummary[]> {
  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      icon: places.icon,
      role: placeMembers.role,
      personal: sql<boolean>`${places.personalOwnerId} is not null`,
      allLists: placeMembers.allLists,
      memberCount: sql<number>`(select count(*)::int from ${placeMembers} pm where pm.place_id = ${places.id})`,
      listCount: sql<number>`(select count(*)::int from ${lists} where ${lists.placeId} = ${places.id})`,
      visibleCount: sql<number>`(select count(*)::int from ${lists} vl where vl.place_id = ${places.id} and ${canSeeListSql(userId, "vl")})`,
    })
    .from(placeMembers)
    .innerJoin(places, eq(places.id, placeMembers.placeId))
    .where(eq(placeMembers.userId, userId))
    .orderBy(desc(sql`${places.personalOwnerId} is not null`), asc(placeMembers.joinedAt), asc(places.name));
  return rows;
}

export async function isPlaceMember(userId: string, placeId: string): Promise<boolean> {
  const [row] = await db
    .select({ placeId: placeMembers.placeId })
    .from(placeMembers)
    .where(and(eq(placeMembers.userId, userId), eq(placeMembers.placeId, placeId)));
  return Boolean(row);
}

/**
 * The chosen place if the user still belongs to it, otherwise their first
 * shared place, otherwise their personal area.
 */
export async function getCurrentPlace(userId: string) {
  await ensurePersonalPlace(userId);
  const userPlaces = await getUserPlaces(userId);
  const chosen = (await cookies()).get(PLACE_COOKIE)?.value;
  const place =
    userPlaces.find((p) => p.id === chosen) ?? userPlaces.find((p) => !p.personal) ?? userPlaces[0];
  return { place, places: userPlaces };
}

/** For pages inside a place: needs a session. Every user has at least their personal area. */
export async function requirePlace() {
  const user = await requireUser();
  const { place, places: userPlaces } = await getCurrentPlace(user.id);
  return { user, place, places: userPlaces };
}

/** Right after signing in, the home screen opens on the personal area. */
export async function openPersonalArea(userId: string): Promise<void> {
  await setCurrentPlace(await ensurePersonalPlace(userId));
}

export async function setCurrentPlace(placeId: string): Promise<void> {
  (await cookies()).set(PLACE_COOKIE, placeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
