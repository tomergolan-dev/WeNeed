import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChoreList } from "@/components/chores/chore-list";
import { requireMember } from "@/lib/auth";
import { getChores, getHousehold } from "@/lib/lists";

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
  const member = await requireMember();
  const [chores, household] = await Promise.all([
    getChores(member.householdId),
    getHousehold(member.householdId),
  ]);
  const people = household?.members.map(({ id, name }) => ({ id, name })) ?? [];

  return (
    <>
      <AutoRefresh />
      <ChoreList chores={chores} members={people} currentMemberId={member.id} />
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
