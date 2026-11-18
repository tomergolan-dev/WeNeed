import { defineRouting } from "next-intl/routing";

/**
 * Hebrew lives at the plain addresses ("/lists/…"), English under "/en".
 * The proxy remembers the last language a visitor chose (NEXT_LOCALE cookie, for a year)
 * and otherwise follows the browser's language.
 */
export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
  localePrefix: "as-needed",
  // next-intl keeps the choice only until the browser closes by default; an
  // installed app closes often, so keep it for a year.
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];

export function directionOf(locale: string): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}
