import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/auth";
import { getHousehold } from "@/lib/lists";
import { HouseholdNameForm } from "./household-name-form";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted" />}>
        <HouseholdSettings />
      </Suspense>
    </>
  );
}

async function HouseholdSettings() {
  const member = await requireMember();
  const [t, household] = await Promise.all([
    getTranslations("Settings"),
    getHousehold(member.householdId),
  ]);
  if (!household) notFound();

  return (
    <div className="flex flex-col gap-6">
      <HouseholdNameForm name={household.name} />
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("members")}</h2>
        <ul className="flex flex-col">
          {household.members.map((m) => (
            <li key={m.id} className="flex min-h-11 items-center justify-between border-b last:border-b-0">
              <span>{m.name}</span>
              <span dir="ltr" className="text-sm text-muted-foreground">
                {m.phone}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
