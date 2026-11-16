// Manages the sign-in allowlist: sign-in codes are sent only to these numbers.
// Usage:
//   npm run phone:allow -- 050-1234567 "Name"   add a number (the name is used on first sign-in)
//   npm run phone:allow -- --remove 050-1234567  remove a number
//   npm run phone:allow -- --list                show all numbers
// Runs against DATABASE_URL in .env.local (the dev branch); set it explicitly for production.
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { allowedPhones } from "@/db/schema";
import { normalizePhone } from "@/lib/phone";

function phoneArg(value: string | undefined): string {
  const phone = value ? normalizePhone(value) : null;
  if (!phone) throw new Error(`Invalid phone number "${value ?? ""}"`);
  return phone;
}

async function main() {
  const [first, second] = process.argv.slice(2);

  if (first === "--list") {
    const rows = await db.select().from(allowedPhones).orderBy(asc(allowedPhones.createdAt));
    for (const row of rows) console.log(`${row.phone}  ${row.note ?? ""}`);
    return;
  }

  if (first === "--remove") {
    const phone = phoneArg(second);
    const removed = await db.delete(allowedPhones).where(eq(allowedPhones.phone, phone)).returning();
    console.log(removed.length ? `Removed ${phone}` : `${phone} was not on the list`);
    return;
  }

  if (!first) {
    console.error('Usage: npm run phone:allow -- 050-1234567 "Name" | --remove 050-1234567 | --list');
    process.exit(1);
  }

  const phone = phoneArg(first);
  const note = second?.trim() || null;
  await db
    .insert(allowedPhones)
    .values({ phone, note })
    .onConflictDoUpdate({ target: allowedPhones.phone, set: { note } });
  console.log(`Allowed ${phone}${note ? ` (${note})` : ""}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
