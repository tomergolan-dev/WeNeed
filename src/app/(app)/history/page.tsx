import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/auth";
import { getCompletedLists } from "@/lib/lists";

export default async function HistoryPage() {
  const t = await getTranslations("History");

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted" />}>
        <CompletedLists />
      </Suspense>
    </>
  );
}

async function CompletedLists() {
  const member = await requireMember();
  const [t, format, lists] = await Promise.all([
    getTranslations("History"),
    getFormatter(),
    getCompletedLists(member.householdId, "shopping"),
  ]);

  if (lists.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {lists.map((list) => (
        <li key={list.id}>
          <Link
            href={`/history/${list.id}`}
            className="flex flex-col gap-0.5 rounded-xl border p-4 transition-colors hover:bg-muted"
          >
            <span className="font-medium">
              {format.dateTime(list.completedAt ?? list.createdAt, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("summary", { bought: list.bought, total: list.total })}
              {list.completedByName && ` · ${t("finishedBy", { name: list.completedByName })}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
