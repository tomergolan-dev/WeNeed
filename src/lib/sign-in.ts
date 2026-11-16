import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { allowedPhones, signInCodes, users } from "@/db/schema";
import { sendSignInCode } from "./sign-in-delivery";

// One-time sign-in codes. Codes are sent only to numbers on the allowlist, so
// strangers can't trigger messages (and their cost).

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 3;

function hashCode(phone: string, code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

export type RequestCodeResult = "sent" | "notAllowed" | "tooMany" | "deliveryFailed";

export async function requestSignInCode(phone: string): Promise<RequestCodeResult> {
  const [allowed] = await db.select().from(allowedPhones).where(eq(allowedPhones.phone, phone));
  if (!allowed) return "notAllowed";

  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(signInCodes)
    .where(and(eq(signInCodes.phone, phone), gt(signInCodes.createdAt, since)));
  if (recent >= MAX_CODES_PER_WINDOW) return "tooMany";

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.insert(signInCodes).values({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  try {
    await sendSignInCode(phone, code);
    return "sent";
  } catch (error) {
    console.error("[sign-in] delivery failed", error);
    return "deliveryFailed";
  }
}

export type VerifyCodeResult = { ok: true; userId: string } | { ok: false; error: "wrongCode" | "expired" };

/** Checks the latest code for the phone; on success returns the user, creating it on first sign-in. */
export async function verifySignInCode(phone: string, code: string): Promise<VerifyCodeResult> {
  const [latest] = await db
    .select()
    .from(signInCodes)
    .where(
      and(eq(signInCodes.phone, phone), isNull(signInCodes.usedAt), gt(signInCodes.expiresAt, new Date())),
    )
    .orderBy(desc(signInCodes.createdAt))
    .limit(1);
  if (!latest || latest.attempts >= MAX_ATTEMPTS) return { ok: false, error: "expired" };

  await db
    .update(signInCodes)
    .set({ attempts: sql`${signInCodes.attempts} + 1` })
    .where(eq(signInCodes.id, latest.id));

  const expected = Buffer.from(latest.codeHash, "hex");
  const actual = Buffer.from(hashCode(phone, code.trim()), "hex");
  if (!timingSafeEqual(expected, actual)) return { ok: false, error: "wrongCode" };

  // Mark as used atomically, so a code works only once.
  const [used] = await db
    .update(signInCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(signInCodes.id, latest.id), isNull(signInCodes.usedAt)))
    .returning({ id: signInCodes.id });
  if (!used) return { ok: false, error: "expired" };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (existing) return { ok: true, userId: existing.id };

  // First sign-in: the name comes from the allowlist note.
  const [allowed] = await db.select().from(allowedPhones).where(eq(allowedPhones.phone, phone));
  const [created] = await db
    .insert(users)
    .values({ phone, name: allowed?.note?.trim() || phone })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (created) return { ok: true, userId: created.id };
  const [raced] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  return { ok: true, userId: raced.id };
}
