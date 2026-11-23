import "server-only";
import { and, eq, ne, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/db";
import { contactNames, users } from "@/db/schema";

/**
 * A person's name as the viewer sees it: what the viewer calls them, if they
 * gave them a name, otherwise the name they chose. `id` and `name` default to
 * the users table's columns; pass others when users is aliased or joined twice.
 */
export function nameFor(
  viewerId: string,
  id: AnyColumn | ReturnType<typeof sql> = users.id,
  name: AnyColumn | ReturnType<typeof sql> = users.name,
) {
  return sql<string>`coalesce((select ${contactNames.name} from ${contactNames} where ${contactNames.ownerId} = ${viewerId} and ${contactNames.userId} = ${id}), ${name})`;
}

/** What the viewer calls one person, or null. */
export async function contactName(viewerId: string, userId: string) {
  const [row] = await db
    .select({ name: contactNames.name })
    .from(contactNames)
    .where(and(eq(contactNames.ownerId, viewerId), eq(contactNames.userId, userId)));
  return row?.name ?? null;
}

/**
 * The people the user shares something with (a place, or a list), and anyone
 * they already named, with the name each chose and what the user calls them.
 */
export async function getMyPeople(userId: string) {
  return db
    .select({ id: users.id, name: users.name, nickname: contactNames.name })
    .from(users)
    .leftJoin(contactNames, and(eq(contactNames.ownerId, userId), eq(contactNames.userId, users.id)))
    .where(
      and(
        ne(users.id, userId),
        sql`(
          ${contactNames.userId} is not null
          or ${users.id} in (
            select pm2.user_id from place_members pm1 join place_members pm2 on pm2.place_id = pm1.place_id
            where pm1.user_id = ${userId}
          )
          or ${users.id} in (
            select lm.user_id from list_members lm join lists l on l.id = lm.list_id
            join place_members pm on pm.place_id = l.place_id where pm.user_id = ${userId}
          )
          or ${users.id} in (
            select pm.user_id from list_members lm join lists l on l.id = lm.list_id
            join place_members pm on pm.place_id = l.place_id where lm.user_id = ${userId}
          )
          or ${users.id} in (
            select lm2.user_id from list_members lm1 join list_members lm2 on lm2.list_id = lm1.list_id
            where lm1.user_id = ${userId}
          )
        )`,
      ),
    )
    .orderBy(sql`coalesce(${contactNames.name}, ${users.name})`);
}
