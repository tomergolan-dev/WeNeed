"use server";

import { createHmac } from "node:crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { demoAiRequests } from "@/db/schema";
import {
  parseChecklist,
  parseChores,
  parseShopping,
  type ChecklistParse,
  type ChoresParse,
  type ShoppingParse,
} from "@/lib/ai/list-assistant";
import { israelNow } from "@/lib/due";

// The public demo's AI chat. It only reads the message: the visitor's browser
// applies the result to its own copy of the lists, and nothing is saved here
// except a count of messages for the limits below.
const DAILY_LIMIT_PER_VISITOR = 10;
const DAILY_LIMIT_TOTAL = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DemoParseError = "invalid" | "aiLimit" | "aiFailed";
export type DemoParse =
  | { ok: true; type: "shopping"; result: ShoppingParse }
  | { ok: true; type: "checklist"; result: ChecklistParse }
  | { ok: true; type: "tasks"; result: ChoresParse }
  | { ok: false; error: DemoParseError };

const name = z.string().trim().min(1).max(200);
const input = z.object({
  type: z.enum(["shopping", "tasks", "checklist"]),
  text: z.string().trim().min(1).max(500),
  current: z.array(name).max(200),
  sender: name,
  members: z.array(name).max(10),
});

/** A keyed hash of the visitor's IP address: counts visitors without storing addresses. */
async function visitorKey() {
  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`demo:${ip}`).digest("base64url");
}

async function withinLimits() {
  const visitor = await visitorKey();
  const since = new Date(Date.now() - DAY_MS);
  const [[mine], [all]] = await Promise.all([
    db
      .select({ n: count() })
      .from(demoAiRequests)
      .where(and(eq(demoAiRequests.visitor, visitor), gt(demoAiRequests.createdAt, since))),
    db.select({ n: count() }).from(demoAiRequests).where(gt(demoAiRequests.createdAt, since)),
  ]);
  if (mine.n >= DAILY_LIMIT_PER_VISITOR || all.n >= DAILY_LIMIT_TOTAL) return false;
  await db.insert(demoAiRequests).values({ visitor });
  return true;
}

/** Reads a message from a demo list's AI chat. */
export async function parseDemoMessage(raw: z.input<typeof input>): Promise<DemoParse> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { type, text, current, sender, members } = parsed.data;

  if (!(await withinLimits())) return { ok: false, error: "aiLimit" };

  try {
    if (type === "shopping") {
      const result = await parseShopping(text, current);
      return result ? { ok: true, type, result } : { ok: false, error: "aiFailed" };
    }
    if (type === "checklist") {
      const result = await parseChecklist(text, current);
      return result ? { ok: true, type, result } : { ok: false, error: "aiFailed" };
    }
    const result = await parseChores(text, { sender, members }, israelNow());
    return result ? { ok: true, type, result } : { ok: false, error: "aiFailed" };
  } catch (error) {
    console.error("[demo-ai] chat failed", error);
    return { ok: false, error: "aiFailed" };
  }
}
