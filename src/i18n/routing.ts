import { defineRouting } from "next-intl/routing";

/**
 * Hebrew lives at the plain addresses ("/lists/…"), English under "/en".
 * The proxy remembers the last language a visitor chose (NEXT_LOCALE cookie)
 * and otherwise follows the browser's language.
 */
export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export function directionOf(locale: string): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}
