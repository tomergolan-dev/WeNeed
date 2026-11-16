import { decodeIdToken } from "arctic";
import { cookies } from "next/headers";
import { normalizeEmail } from "@/lib/email";
import { GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE, googleClient, type GoogleClaims } from "@/lib/google";
import { startSession } from "@/lib/session";
import { findOrCreateUser } from "@/lib/sign-in";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = () =>
    Response.redirect(new URL("/login?error=googleFailed", url.origin));

  const jar = await cookies();
  const state = jar.get(GOOGLE_STATE_COOKIE)?.value;
  const verifier = jar.get(GOOGLE_VERIFIER_COOKIE)?.value;
  jar.delete(GOOGLE_STATE_COOKIE);
  jar.delete(GOOGLE_VERIFIER_COOKIE);

  const code = url.searchParams.get("code");
  if (!code || !state || !verifier || url.searchParams.get("state") !== state) return fail();

  let claims: GoogleClaims;
  try {
    const tokens = await googleClient(url.origin).validateAuthorizationCode(code, verifier);
    claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
  } catch (error) {
    console.error("[sign-in] Google exchange failed", error);
    return fail();
  }

  const email = claims.email && claims.email_verified ? normalizeEmail(claims.email) : null;
  if (!email) return fail();

  await startSession(await findOrCreateUser(email, claims.name));
  return Response.redirect(new URL("/", url.origin));
}
