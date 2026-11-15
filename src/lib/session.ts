import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

// A signed cookie holding the member id. No password, no third-party auth:
// the only way in is a one-time login link (see login-tokens.ts).

const COOKIE_NAME = "wn_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type Payload = { memberId: string; exp: number };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set (at least 32 characters)");
  }
  return value;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function encode(payload: Payload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decode(value: string): Payload | null {
  const [data, signature] = value.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Payload;
    if (typeof payload.memberId !== "string" || payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getSessionMemberId(): Promise<string | null> {
  // Expiry checks read the clock, so this must run at request time.
  await connection();
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value ? (decode(value)?.memberId ?? null) : null;
}

export async function startSession(memberId: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  (await cookies()).set(COOKIE_NAME, encode({ memberId, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
