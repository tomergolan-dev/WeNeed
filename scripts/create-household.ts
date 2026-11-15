// Creates a household with its members.
// Usage: npm run household:create -- "Household name" "Name:+972501234567" ["Name:+9725..."]
import { db } from "@/db";
import { households, members } from "@/db/schema";

const E164 = /^\+[1-9]\d{7,14}$/;

async function main() {
  const [name, ...memberArgs] = process.argv.slice(2);
  if (!name || memberArgs.length === 0) {
    console.error('Usage: npm run household:create -- "Household name" "Name:+972501234567" ...');
    process.exit(1);
  }

  const parsed = memberArgs.map((arg) => {
    const i = arg.lastIndexOf(":");
    const memberName = arg.slice(0, i).trim();
    const phone = arg.slice(i + 1).trim();
    if (i === -1 || !memberName || !E164.test(phone)) {
      throw new Error(`Invalid member "${arg}". Expected Name:+972501234567 (E.164).`);
    }
    return { name: memberName, phone };
  });

  const [household] = await db.insert(households).values({ name }).returning();
  const created = await db
    .insert(members)
    .values(parsed.map((m) => ({ ...m, householdId: household.id })))
    .returning();

  console.log(`Household "${household.name}" (${household.id})`);
  for (const m of created) console.log(`  ${m.name}  ${m.phone}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
