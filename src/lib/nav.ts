import "server-only";
import { cache } from "react";
import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { items, lists, rounds } from "@/db/schema";
import { getCurrentPlace, type CurrentUser } from "./auth";
import { dueAt, dueStatus, todayIn } from "./due";
import { canSeeListSql } from "./list-access";
import { getPlaceLists, getSharedWithMe } from "./lists";
import type { SidebarGroup, UrgentTask } from "@/components/sidebar";

/** Open tasks for the user (theirs or nobody's) that are late or due within a day, soonest first. */
async function getUrgentTasks(userId: string): Promise<UrgentTask[]> {
  const now = Date.now();
  const rows = await db
    .select({
      id: items.id,
      name: items.name,
      listId: lists.id,
      listName: lists.name,
      done: items.done,
      dueDate: items.dueDate,
      dueTime: items.dueTime,
    })
    .from(items)
    .innerJoin(rounds, and(eq(rounds.id, items.roundId), eq(rounds.status, "active")))
    .innerJoin(lists, and(eq(lists.id, rounds.listId), eq(lists.type, "tasks")))
    .where(
      and(
        canSeeListSql(userId),
        eq(items.done, false),
        isNotNull(items.dueDate),
        // "Soon" is within a day, so nothing dated later than the day after tomorrow.
        lte(items.dueDate, todayIn(now + 2 * 86_400_000)),
        or(isNull(items.assigneeId), eq(items.assigneeId, userId)),
      ),
    );
  return rows
    .filter((row) => dueStatus(row, now) !== "later")
    .sort((a, b) => dueAt(a.dueDate!, a.dueTime) - dueAt(b.dueDate!, b.dueTime))
    .slice(0, 8)
    .map((row) => ({ id: row.id, name: row.name, listId: row.listId, listName: row.listName, dueDate: row.dueDate, dueTime: row.dueTime }));
}

/**
 * What the side menu shows (the wide-screen sidebar and the phone's menu):
 * every place the user belongs to with its lists, and their urgent tasks.
 * Cached per request, since both may render on one page.
 */
export const getNav = cache(async (user: CurrentUser) => {
  const [t, { place, places }] = await Promise.all([getTranslations("Places"), getCurrentPlace(user.id)]);
  const [lists, shared, urgent] = await Promise.all([
    Promise.all(places.map((p) => getPlaceLists(p.id, user.id))),
    getSharedWithMe(user.id),
    getUrgentTasks(user.id),
  ]);
  const groups: SidebarGroup[] = places.map((p, i) => ({
    id: p.id,
    name: p.personal ? t("personal") : p.name,
    icon: p.icon,
    lists: lists[i],
    shared: p.personal ? shared : undefined,
  }));
  return { groups, currentId: place.id, urgent };
});
