import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { CheckIcon } from "lucide-react";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { formatQuantity, groupByCategory } from "@/lib/items";
import { getHouseholdList, getListItems } from "@/lib/lists";
import { cn } from "@/lib/utils";

export default function HistoryListPage({ params }: PageProps<"/history/[id]">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-lg bg-muted" />}>
      <CompletedList params={params} />
    </Suspense>
  );
}

async function CompletedList({ params }: Pick<PageProps<"/history/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const member = await requireMember();
  const row = await getHouseholdList(member.householdId, id);
  if (!row || row.list.status !== "completed") notFound();

  const [t, tCategories, format, items] = await Promise.all([
    getTranslations("History"),
    getTranslations("Categories"),
    getFormatter(),
    getListItems(id),
  ]);
  const bought = items.filter((item) => item.done);
  const notBought = items.filter((item) => !item.done);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/history" className="text-sm text-muted-foreground hover:underline">
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">
          {format.dateTime(row.list.completedAt ?? row.list.createdAt, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("summary", { bought: bought.length, total: items.length })}
          {row.completedByName && ` · ${t("finishedBy", { name: row.completedByName })}`}
          {" · "}
          {t("locked")}
        </p>
      </div>

      {notBought.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-muted-foreground">{t("notBought")}</h2>
          <ItemList items={notBought} />
        </section>
      )}

      {groupByCategory(bought).map(({ category, items }) => (
        <section key={category} className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-muted-foreground">{tCategories(category)}</h2>
          <ItemList items={items} />
        </section>
      ))}
    </div>
  );
}

function ItemList({ items }: { items: Awaited<ReturnType<typeof getListItems>> }) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.id} className="flex min-h-10 items-center gap-3 border-b last:border-b-0">
          <CheckIcon className={cn("size-4", item.done ? "text-primary" : "invisible")} />
          <span className={cn(!item.done && "text-muted-foreground")}>{item.name}</span>
          <span className="text-sm text-muted-foreground">{formatQuantity(item)}</span>
        </li>
      ))}
    </ul>
  );
}
