import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChoreList } from "@/components/chores/chore-list";
import { PageHeader } from "@/components/page-header";
import { requirePlace } from "@/lib/auth";
import { getChores, getPlace } from "@/lib/lists";

export default async function ChoresPage() {
  const t = await getTranslations("Chores");

  return (
    <>
      <PageHeader title={t("title")} />
      <main className="flex flex-col gap-4 px-5 pt-3.5 pb-8">
        <Suspense fallback={<ListSkeleton />}>
          <Chores />
        </Suspense>
      </main>
    </>
  );
}

async function Chores() {
  const { user, place } = await requirePlace();
  const [chores, details] = await Promise.all([
    getChores(place.id),
    getPlace(place.id),
  ]);
  const people = details?.members.map(({ id, name }) => ({ id, name })) ?? [];

  return (
    <>
      <AutoRefresh />
      <ChoreList chores={chores} members={people} currentMemberId={user.id} />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
