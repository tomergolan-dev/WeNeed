import "server-only";
import { Google } from "arctic";

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
export type GoogleClaims = { email?: string; email_verified?: boolean; name?: string };
