// Manages the sign-in allowlist: only these addresses can sign in.
// Usage:
//   npm run email:allow -- name@gmail.com "Name"                  add an address (the name is used on first sign-in)
//   npm run email:allow -- name@gmail.com --phone +972501234567   link an address to a user from the bot era
//   npm run email:allow -- --remove name@gmail.com                remove an address
//   npm run email:allow -- --list                                 show all addresses
// Runs against DATABASE_URL in .env.local (the dev branch); set it explicitly for production.
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { allowedEmails, users } from "@/db/schema";
import { normalizeEmail } from "@/lib/email";

function emailArg(value: string | undefined): string {
  const email = value ? normalizeEmail(value) : null;
  if (!email) throw new Error(`Invalid email address "${value ?? ""}"`);
  return email;
}

async function main() {
  const [first, second, third] = process.argv.slice(2);

  if (first === "--list") {
    const rows = await db.select().from(allowedEmails).orderBy(asc(allowedEmails.createdAt));
    for (const row of rows) console.log(`${row.email}  ${row.name ?? ""}`);
    return;
  }

  if (first === "--remove") {
    const email = emailArg(second);
    const removed = await db.delete(allowedEmails).where(eq(allowedEmails.email, email)).returning();
    console.log(removed.length ? `Removed ${email}` : `${email} was not on the list`);
    return;
  }

  if (!first) {
    console.error('Usage: npm run email:allow -- name@gmail.com "Name" | name@gmail.com --phone +9725... | --remove name@gmail.com | --list');
    process.exit(1);
  }

  const email = emailArg(first);

  if (second === "--phone") {
    const [user] = await db.update(users).set({ email }).where(eq(users.phone, third ?? "")).returning();
    if (!user) throw new Error(`No user with phone ${third ?? ""}`);
    await db.insert(allowedEmails).values({ email, name: user.name }).onConflictDoNothing();
    console.log(`Linked ${email} to ${user.name}`);
    return;
  }

  const name = second?.trim() || null;
  await db.insert(allowedEmails).values({ email, name }).onConflictDoUpdate({ target: allowedEmails.email, set: { name } });
  console.log(`Allowed ${email}${name ? ` (${name})` : ""}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
