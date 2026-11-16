import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { signInCodes, users } from "@/db/schema";
import { sendSignInCode } from "./sign-in-delivery";

// Sign-in by email: a one-time code, or Google (see google.ts). Anyone can
// sign up; the limits below keep a bot from flooding an inbox or using up
// the email quota (Resend's free plan sends 100 emails a day).

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CODES_PER_DAY = 80;

function hashCode(email: string, code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export type RequestCodeResult = "sent" | "tooMany" | "busy" | "deliveryFailed";

export async function requestSignInCode(email: string): Promise<RequestCodeResult> {
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(signInCodes)
    .where(and(eq(signInCodes.email, email), gt(signInCodes.createdAt, since)));
  if (recent >= MAX_CODES_PER_WINDOW) return "tooMany";

  const [{ today }] = await db
    .select({ today: sql<number>`count(*)::int` })
    .from(signInCodes)
    .where(gt(signInCodes.createdAt, new Date(Date.now() - DAY_MS)));
  if (today >= MAX_CODES_PER_DAY) return "busy";

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.insert(signInCodes).values({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  try {
    await sendSignInCode(email, code);
    return "sent";
  } catch (error) {
    console.error("[sign-in] delivery failed", error);
    return "deliveryFailed";
  }
}

export type VerifyCodeResult = { ok: true; userId: string } | { ok: false; error: "wrongCode" | "expired" };

/** Checks the latest code for the address; on success returns the user. */
export async function verifySignInCode(email: string, code: string): Promise<VerifyCodeResult> {
  const [latest] = await db
    .select()
    .from(signInCodes)
    .where(and(eq(signInCodes.email, email), isNull(signInCodes.usedAt), gt(signInCodes.expiresAt, new Date())))
    .orderBy(desc(signInCodes.createdAt))
    .limit(1);
  if (!latest || latest.attempts >= MAX_ATTEMPTS) return { ok: false, error: "expired" };

  await db
    .update(signInCodes)
    .set({ attempts: sql`${signInCodes.attempts} + 1` })
    .where(eq(signInCodes.id, latest.id));

  const expected = Buffer.from(latest.codeHash, "hex");
  const actual = Buffer.from(hashCode(email, code.trim()), "hex");
  if (!timingSafeEqual(expected, actual)) return { ok: false, error: "wrongCode" };

  // Mark as used atomically, so a code works only once.
  const [used] = await db
    .update(signInCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(signInCodes.id, latest.id), isNull(signInCodes.usedAt)))
    .returning({ id: signInCodes.id });
  if (!used) return { ok: false, error: "expired" };

  return { ok: true, userId: await findOrCreateUser(email) };
}

/**
 * The user with this verified address, created on first sign-in. The name
 * comes from Google when available, otherwise from the address.
 */
export async function findOrCreateUser(email: string, name?: string): Promise<string> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return existing.id;

  const [created] = await db
    .insert(users)
    .values({ email, name: name?.trim() || email.split("@")[0] })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (created) return created.id;
  const [raced] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  return raced.id;
}
