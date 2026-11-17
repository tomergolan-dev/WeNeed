"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Switches between Hebrew and English on the same page. */
export function LanguageSwitch({ className }: { className?: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const other = locale === "he" ? "en" : "he";

  return (
    <button
      type="button"
      lang={other}
      aria-label={t("languageLabel")}
      disabled={pending}
      onClick={() => startTransition(() => router.replace(pathname, { locale: other }))}
      className={cn(
        "flex h-11 items-center rounded-[14px] border bg-card px-3.5 text-sm font-semibold text-muted-foreground transition-colors active:bg-muted disabled:opacity-60",
        className,
      )}
    >
      {t("language")}
    </button>
  );
}
