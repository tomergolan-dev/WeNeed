import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { z } from "zod";
import type { Item } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { formatQuantity, groupByCategory } from "@/lib/items";
import { getCompletedRound, getRoundItems } from "@/lib/lists";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/lists/[id]/history/[roundId]">;

export default function RoundPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-5 mt-4 h-60 animate-pulse rounded-[18px] bg-muted" />}>
      <Round params={params} />
    </Suspense>
  );
}

async function Round({ params }: Pick<Props, "params">) {
  const { id, roundId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(roundId).success) notFound();

  const user = await requireUser();
  const row = await getCompletedRound(user.id, id, roundId);
  if (!row) notFound();

  const [t, tCategories, tItem, format, items] = await Promise.all([
    getTranslations("History"),
    getTranslations("Categories"),
    getTranslations("ItemForm"),
    getFormatter(),
    getRoundItems(roundId),
  ]);
  const bought = items.filter((item) => item.done);
  const notBought = items.filter((item) => !item.done);
  const units = tItem("units");

  return (
    <>
      <PageHeader
        title={format.dateTime(row.round.completedAt ?? row.round.createdAt, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        subtitle={row.listName}
        back={`/lists/${id}/history`}
      />
      <main className="flex flex-col gap-4 px-5 pt-3.5 pb-8">
        <p className="px-1 text-sm text-muted-foreground">
          {t("summary", { bought: bought.length, total: items.length })}
          {row.completedByName && ` · ${t("finishedBy", { name: row.completedByName })}`}
          {" · "}
          {t("locked")}
        </p>

        {notBought.length > 0 && (
          <Section title={t("notBought")}>
            <ItemList items={notBought} units={units} />
          </Section>
        )}

        {groupByCategory(bought).map(({ category, items }) => (
          <Section key={category} title={tCategories(category)}>
            <ItemList items={items} units={units} />
          </Section>
        ))}
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function ItemList({ items, units }: { items: Item[]; units: string }) {
  return (
    <ul className="rounded-2xl border border-border/60 bg-card">
      {items.map((item) => (
        <li key={item.id} className="flex min-h-12 items-center gap-3 border-b border-[#f0f2f1] px-3.5 last:border-b-0">
          <Check className={cn("size-4 shrink-0", item.done ? "text-primary" : "invisible")} aria-hidden />
          <span className={cn("min-w-0 flex-1 truncate", !item.done && "text-muted-foreground")}>{item.name}</span>
          <span className="shrink-0 text-sm text-muted-foreground">{formatQuantity(item, units)}</span>
        </li>
      ))}
    </ul>
  );
}
