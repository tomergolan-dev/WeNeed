import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PlaceForm } from "@/components/places/place-form";
import { requirePlace } from "@/lib/auth";
import { getPlace } from "@/lib/lists";
import { formatPhone } from "@/lib/phone";
import { isPlaceIcon } from "@/lib/place-icons";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-3xl bg-muted" />}>
        <PlaceSettings />
      </Suspense>
    </>
  );
}

async function PlaceSettings() {
  const { user, place: current } = await requirePlace();
  const [t, place] = await Promise.all([getTranslations("Settings"), getPlace(current.id)]);
  if (!place) notFound();

  return (
    <div className="flex flex-col gap-8">
      {/* Keyed by place, so switching places resets the form. */}
      <PlaceForm
        key={place.id}
        mode="edit"
        name={place.name}
        icon={isPlaceIcon(place.icon) ? place.icon : "home"}
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-muted-foreground">{t("members")}</h2>
        <ul className="flex flex-col rounded-[18px] border bg-card px-4 shadow-soft">
          {place.members.map((m) => (
            <li key={m.id} className="flex min-h-13 items-center justify-between gap-3 border-b last:border-b-0">
              <span className="font-medium">
                {m.name}
                {m.id === user.id && <span className="ms-1.5 text-sm font-normal text-muted-foreground">{t("you")}</span>}
                {m.role === "owner" && (
                  <span className="ms-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    {t("owner")}
                  </span>
                )}
              </span>
              <span dir="ltr" className="text-sm text-muted-foreground">
                {formatPhone(m.phone)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
