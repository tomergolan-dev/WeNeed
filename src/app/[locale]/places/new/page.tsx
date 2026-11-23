import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { X } from "lucide-react";
import { Brand } from "@/components/brand";
import { PlaceForm } from "@/components/places/place-form";
import { requireUser } from "@/lib/auth";

// Outside the (app) layout, which needs a place: this is where the first one is made.
export default function NewPlacePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-2.5 pb-[18px]">
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
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background py-2">
        <Brand />
        <Link
          href="/"
          aria-label={t("close")}
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
        >
          <X className="size-5" aria-hidden />
        </Link>
      </header>
      <h1 className="mt-8 text-[22px] font-extrabold tracking-tight">
        {t("createTitle")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("createSubtitle")}</p>
      <PlaceForm mode="create" />
    </>
  );
}
