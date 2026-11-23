import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getCompletedRounds, getDoneTasks, getListFor } from "@/lib/lists";
import { TIME_ZONE } from "@/lib/due";

export default function HistoryPage({ params }: PageProps<"/[locale]/lists/[id]/history">) {
  return (
    <Suspense fallback={<div className="mx-5 mt-4 h-40 animate-pulse rounded-[18px] bg-muted" />}>
      <History params={params} />
    </Suspense>
  );
}

async function History({ params }: Pick<PageProps<"/[locale]/lists/[id]/history">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const list = (await getListFor(user.id, id))?.list;
  if (!list || list.type === "checklist") notFound();
  if (list.type === "tasks") return <TaskHistory listId={list.id} listName={list.name} userId={user.id} />;

  const [t, format, rounds] = await Promise.all([
    getTranslations("History"),
    getFormatter(),
    getCompletedRounds(list.id, user.id),
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

/** A tasks list's history: every done task, by month, with when and by whom. */
async function TaskHistory({ listId, listName, userId }: { listId: string; listName: string; userId: string }) {
  const [t, format, tasks] = await Promise.all([
    getTranslations("History"),
    getFormatter(),
    getDoneTasks(listId, userId),
  ]);
  // Grouped by the month they were done in, in Israel time.
  const months: { label: string; tasks: typeof tasks }[] = [];
  for (const task of tasks) {
    const label = task.doneAt
      ? format.dateTime(task.doneAt, { month: "long", year: "numeric", timeZone: TIME_ZONE })
      : t("unknownDate");
    const last = months.at(-1);
    if (last?.label === label) last.tasks.push(task);
    else months.push({ label, tasks: [task] });
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={listName} back={`/lists/${listId}`} />
      <main className="px-5 pt-3.5 pb-8">
        {tasks.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">{t("tasksEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-5">
            {months.map((month) => (
              <section key={month.label} className="flex flex-col gap-2">
                <h2 className="px-1 text-sm font-semibold text-muted-foreground">{month.label}</h2>
                <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                  {month.tasks.map((task) => (
                    <li key={task.id} className="flex flex-col gap-0.5 border-t px-4 py-3 first:border-t-0">
                      <span className="font-medium">{task.name}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {task.doneAt &&
                          format.dateTime(task.doneAt, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: TIME_ZONE,
                          })}
                        {task.doneBy === userId
                          ? ` · ${t("doneByMe")}`
                          : task.doneByName && ` · ${t("doneBy", { name: `\u2068${task.doneByName}\u2069` })}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
