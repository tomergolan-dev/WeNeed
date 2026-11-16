import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE, googleClient } from "@/lib/google";

export async function GET(request: Request) {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = googleClient(new URL(request.url).origin).createAuthorizationURL(state, verifier, [
    "openid",
    "email",
    "profile",
  ]);
  url.searchParams.set("prompt", "select_account");

  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };
  jar.set(GOOGLE_STATE_COOKIE, state, options);
  jar.set(GOOGLE_VERIFIER_COOKIE, verifier, options);

  return Response.redirect(url);
}
