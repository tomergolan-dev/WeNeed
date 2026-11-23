import "server-only";
import { Google } from "arctic";
import { put } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AVATAR_PX, MAX_AVATAR_BYTES } from "./avatars";

// "Sign in with Google" (OpenID Connect, authorization code flow with PKCE).

export const GOOGLE_STATE_COOKIE = "wn_google_state";
export const GOOGLE_VERIFIER_COOKIE = "wn_google_verifier";

export function googleClient(origin: string): Google {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  return new Google(clientId, clientSecret, `${origin}/api/auth/google/callback`);
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** The ID token claims we use. It comes straight from Google's token endpoint over TLS, so it is trusted as is. */
export type GoogleClaims = { email?: string; email_verified?: boolean; name?: string; picture?: string };

/**
 * The Google profile photo as the user's badge, the first time they sign in
 * with Google and have never chosen one: fetched once at 256px and kept in
 * the private Blob store like an uploaded photo, so the app never loads it
 * from Google afterwards.
 */
export async function importGooglePhoto(userId: string, picture: string): Promise<void> {
  const [user] = await db.select({ avatar: users.avatar }).from(users).where(eq(users.id, userId));
  if (!user || user.avatar !== null) return;
  const url = new URL(picture);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".googleusercontent.com")) return;
  // Google photo links end with a size, like "=s96-c".
  const sized = picture.replace(/=s\d+(-c)?$/, "") + `=s${AVATAR_PX}-c`;
  const response = await fetch(sized);
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(type)) return;
  const body = await response.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_AVATAR_BYTES) return;
  const blob = await put(`avatars/${userId}/google`, body, { access: "private", addRandomSuffix: true, contentType: type });
  // Only if still unchosen: the user may have picked something meanwhile.
  await db
    .update(users)
    .set({ avatar: `photo:${blob.pathname}` })
    .where(and(eq(users.id, userId), isNull(users.avatar)));
}
