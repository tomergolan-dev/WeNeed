import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { loginTokens } from "@/db/schema";

// One-time login links. Only the SHA-256 of the token is stored.
// Not marked server-only so CLI scripts can create links too.

const DEFAULT_TTL_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function loginUrl(token: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/login/${token}`;
}

export async function createLoginToken(
  memberId: string,
  ttlHours = DEFAULT_TTL_HOURS,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(loginTokens).values({
    tokenHash: hashToken(token),
    memberId,
    expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
  });
  return token;
}

/** Marks the token as used and returns its member id, or null if invalid. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const [row] = await db
    .update(loginTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(loginTokens.tokenHash, hashToken(token)),
        isNull(loginTokens.usedAt),
        gt(loginTokens.expiresAt, new Date()),
      ),
    )
    .returning({ memberId: loginTokens.memberId });
  return row?.memberId ?? null;
}
