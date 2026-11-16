import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChoreList } from "@/components/chores/chore-list";
import { requirePlace } from "@/lib/auth";
import { getChores, getPlace } from "@/lib/lists";

export default async function ChoresPage() {
  const t = await getTranslations("Chores");

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Chores />
      </Suspense>
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
