// Links an email address to a user carried over from the WhatsApp-bot era,
// found by phone number, so they keep their places and history when they
// sign in with that address. New users need nothing: anyone can sign up.
// Usage: npm run user:link-email -- name@gmail.com +972501234567
// Runs against DATABASE_URL in .env.local (the dev branch); set it explicitly for production.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { normalizeEmail } from "@/lib/email";

async function main() {
  const [emailInput, phone] = process.argv.slice(2);
  const email = emailInput ? normalizeEmail(emailInput) : null;
  if (!email || !phone) {
    console.error("Usage: npm run user:link-email -- name@gmail.com +972501234567");
    process.exit(1);
  }

  const [user] = await db.update(users).set({ email }).where(eq(users.phone, phone)).returning();
  if (!user) throw new Error(`No user with phone ${phone}`);
  console.log(`Linked ${email} to ${user.name}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
