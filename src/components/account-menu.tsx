"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Menu } from "lucide-react";
import { logOut } from "@/app/actions";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LOCALES = ["he", "en"] as const;

/**
 * The one button in the top row, the same in every place: it opens the
 * user's own settings (the language) and signing out. A place's settings
 * are not here; they open from the place picker.
 */
export function AccountMenu({
  user,
  className,
}: {
  /** Null in the demo: no account, and "Sign in" instead of signing out. */
  user: { name: string; email: string | null } | null;
  className?: string;
}) {
  const t = useTranslations("Account");
  return (
    <Drawer>
      <DrawerTrigger
        aria-label={t("open")}
        className={cn(
          "flex size-10 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors active:bg-muted",
          className,
        )}
      >
        <Menu className="size-5" aria-hidden />
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl rounded-t-[28px] bg-[#f6f8f7] px-5 pt-2.5 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#d5dad8]" />
        <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
        {user && (
          <div className="mb-4 text-center">
            <p className="font-semibold">{user.name}</p>
            {user.email && (
              <p dir="ltr" className="text-sm text-muted-foreground">
                {user.email}
              </p>
            )}
          </div>
        )}
        <div className="rounded-[18px] border bg-card">
          <div className="flex min-h-15 items-center gap-3 px-4 py-2.5">
            <Globe className="size-5 text-muted-foreground" aria-hidden />
            <span className="flex-1">{t("language")}</span>
            <LanguagePicker />
          </div>
        </div>
        {user ? (
          <form action={logOut} className="mt-5 text-center">
            <button type="submit" className="h-10 px-4 text-[15px] text-muted-foreground active:text-foreground">
              {t("logOut")}
            </button>
          </form>
        ) : (
          <div className="mt-5 text-center">
            <Link href="/login" className="inline-flex h-10 items-center px-4 text-[15px] font-semibold text-accent-foreground">
              {t("signIn")}
            </Link>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

/** עברית | English, as two segments; the chosen language is remembered for a year. */
function LanguagePicker() {
  const t = useTranslations("Account");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="radiogroup" aria-label={t("language")} className="flex rounded-full bg-muted p-1">
      {LOCALES.map((code) => {
        const on = code === locale;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={on}
            lang={code}
            disabled={pending}
            onClick={() => !on && startTransition(() => router.replace(pathname, { locale: code }))}
            className={cn(
              "h-8 rounded-full px-3.5 text-sm text-muted-foreground transition-colors",
              on && "bg-card font-semibold text-foreground shadow-sm",
            )}
          >
            {t(code)}
          </button>
        );
      })}
    </div>
  );
}
