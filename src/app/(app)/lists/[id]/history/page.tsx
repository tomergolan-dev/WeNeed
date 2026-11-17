import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getCompletedRounds, getListFor } from "@/lib/lists";

export default function HistoryPage({ params }: PageProps<"/lists/[id]/history">) {
  return (
    <Suspense fallback={<div className="mx-5 mt-4 h-40 animate-pulse rounded-[18px] bg-muted" />}>
      <History params={params} />
    </Suspense>
  );
}

async function History({ params }: Pick<PageProps<"/lists/[id]/history">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const list = (await getListFor(user.id, id))?.list;
  if (!list || list.type !== "shopping") notFound();

  const [t, format, rounds] = await Promise.all([
    getTranslations("History"),
    getFormatter(),
    getCompletedRounds(list.id),
  ]);

  return (
    <>
      <PageHeader title={t("title")} subtitle={list.name} back={`/lists/${list.id}`} />
      <main className="px-5 pt-3.5 pb-8">
        {rounds.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rounds.map((round) => (
              <li key={round.id}>
                <Link
                  href={`/lists/${list.id}/history/${round.id}`}
                  className="flex items-center gap-3 rounded-[18px] border bg-card px-4 py-3.5 shadow-soft transition-colors active:bg-muted"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">
                      {format.dateTime(round.completedAt ?? round.createdAt, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {t("summary", { bought: round.bought, total: round.total })}
                      {round.completedByName && ` · ${t("finishedBy", { name: round.completedByName })}`}
                    </span>
                  </span>
                  <ChevronLeft className="size-4 text-muted-foreground ltr:-scale-x-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
