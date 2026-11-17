import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { X } from "lucide-react";
import { Brand } from "@/components/brand";
import { PlaceForm } from "@/components/places/place-form";
import { requireUser } from "@/lib/auth";

// Outside the (app) layout, which needs a place: this is where the first one is made.
export default function NewPlacePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-[18px]">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
        <NewPlace />
      </Suspense>
    </main>
  );
}

async function NewPlace() {
  await requireUser();
  const t = await getTranslations("Places");

  return (
    <>
      <header className="flex items-center justify-between">
        <Brand />
        <Link
          href="/"
          aria-label={t("close")}
          className="flex size-10 items-center justify-center rounded-full bg-[#eceff0] text-[#4c5853]"
        >
          <X className="size-4" aria-hidden />
        </Link>
      </header>
      <h1 className="mt-8 text-[26px] font-extrabold tracking-tight">
        {t("createTitle")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("createSubtitle")}</p>
      <PlaceForm mode="create" />
    </>
  );
}
