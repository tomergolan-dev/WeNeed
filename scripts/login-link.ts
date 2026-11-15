// Prints a one-time login link for a member, until the bot can send one.
// Usage: npm run login-link -- +972501234567 [hours]
// Links point at APP_URL; override it to get a production link:
//   APP_URL=https://... npm run login-link -- +972501234567
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { createLoginToken, loginUrl } from "@/lib/login-tokens";

async function main() {
  const [phone, hours] = process.argv.slice(2);
  if (!phone) {
    console.error("Usage: npm run login-link -- +972501234567 [hours]");
    process.exit(1);
  }

  const [member] = await db.select().from(members).where(eq(members.phone, phone));
  if (!member) throw new Error(`No member with phone ${phone}`);

  const token = await createLoginToken(member.id, hours ? Number(hours) : undefined);
  console.log(`Login link for ${member.name} (single use):`);
  console.log(loginUrl(token));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
