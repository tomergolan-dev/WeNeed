import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { placeMembers, places, users } from "@/db/schema";
import { getSessionUserId } from "./session";

export type CurrentUser = { id: string; name: string; phone: string };

export type PlaceSummary = {
  id: string;
  name: string;
  icon: string;
  role: "owner" | "member";
  memberCount: number;
};

// The place the user is looking at; any place they belong to can be chosen.
const PLACE_COOKIE = "wn_place";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const [user] = await db
    .select({ id: users.id, name: users.name, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId));
  return user ?? null;
}

/** For pages: sends visitors without a valid session to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** The places a user belongs to, in the order they joined. */
export async function getUserPlaces(userId: string): Promise<PlaceSummary[]> {
  return db
    .select({
      id: places.id,
      name: places.name,
      icon: places.icon,
      role: placeMembers.role,
      memberCount: sql<number>`(select count(*)::int from ${placeMembers} pm where pm.place_id = ${places.id})`,
    })
    .from(placeMembers)
    .innerJoin(places, eq(places.id, placeMembers.placeId))
    .where(eq(placeMembers.userId, userId))
    .orderBy(asc(placeMembers.joinedAt), asc(places.name));
}

export async function isPlaceMember(userId: string, placeId: string): Promise<boolean> {
  const [row] = await db
    .select({ placeId: placeMembers.placeId })
    .from(placeMembers)
    .where(and(eq(placeMembers.userId, userId), eq(placeMembers.placeId, placeId)));
  return Boolean(row);
}

/** The chosen place if the user still belongs to it, otherwise their first place. */
export async function getCurrentPlace(userId: string) {
  const userPlaces = await getUserPlaces(userId);
  const chosen = (await cookies()).get(PLACE_COOKIE)?.value;
  const place = userPlaces.find((p) => p.id === chosen) ?? userPlaces[0] ?? null;
  return { place, places: userPlaces };
}

/** For pages inside a place: needs a session and at least one place. */
export async function requirePlace() {
  const user = await requireUser();
  const { place, places: userPlaces } = await getCurrentPlace(user.id);
  if (!place) redirect("/places/new");
  return { user, place, places: userPlaces };
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
