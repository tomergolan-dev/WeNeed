import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getSessionMemberId } from "./session";

export type CurrentMember = {
  id: string;
  name: string;
  householdId: string;
};

export async function getCurrentMember(): Promise<CurrentMember | null> {
  const memberId = await getSessionMemberId();
  if (!memberId) return null;

  const [member] = await db
    .select({ id: members.id, name: members.name, householdId: members.householdId })
    .from(members)
    .where(eq(members.id, memberId));
  return member ?? null;
}

/** For pages: sends visitors without a valid session to /login. */
export async function requireMember(): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return member;
}
