import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { PlaceForm } from "@/components/places/place-form";
import { requirePlace } from "@/lib/auth";
import { getPlace } from "@/lib/lists";
import { isPlaceIcon } from "@/lib/place-icons";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");

  return (
    <>
      <PageHeader title={t("title")} />
      <main className="px-5 pt-3.5 pb-8">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-3xl bg-muted" />}>
          <PlaceSettings />
        </Suspense>
      </main>
    </>
  );
}

async function PlaceSettings() {
  const { place: current } = await requirePlace();
  // The personal area has no settings of its own.
  if (current.personal) redirect("/");
  const [t, place] = await Promise.all([getTranslations("Settings"), getPlace(current.id)]);
  if (!place) notFound();

  return (
    <div className="flex flex-col gap-8">
      {current.role === "owner" && (
        // Keyed by place, so switching places resets the form.
        <PlaceForm
          key={place.id}
          mode="edit"
          name={place.name}
          icon={isPlaceIcon(place.icon) ? place.icon : "home"}
        />
      )}
      <Link
        href="/members"
        className="flex min-h-15 items-center gap-3 rounded-[18px] border bg-card px-3.5 py-3 shadow-soft transition-colors active:bg-muted"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Users className="size-5" aria-hidden />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="font-semibold">{t("membersLink")}</span>
          <span className="text-[13px] text-muted-foreground">{t("membersCount", { count: place.members.length })}</span>
        </span>
        <ChevronLeft className="size-4 text-muted-foreground ltr:-scale-x-100" aria-hidden />
      </Link>
    </div>
  );
}
