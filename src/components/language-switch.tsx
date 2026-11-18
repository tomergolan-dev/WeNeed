"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Switches between Hebrew and English on the same page: a globe, like the Mac keyboard key. */
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
      aria-label={t("languageLabel")}
      title={t("languageLabel")}
      disabled={pending}
      onClick={() => startTransition(() => router.replace(pathname, { locale: other }))}
      className={cn(
        "flex size-10 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors active:bg-muted disabled:opacity-60",
        className,
      )}
    >
      <Globe className="size-5" aria-hidden />
    </button>
  );
}
