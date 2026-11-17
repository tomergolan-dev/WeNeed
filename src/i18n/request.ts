import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

export const timeZone = "Asia/Jerusalem";

export default getRequestConfig(async ({ requestLocale }) => {
  // Server Components read the language from the "/[locale]" segment, which
  // keeps pages prerenderable. Server Actions and route handlers can't, and
  // get it from the header the proxy adds instead.
  let requested: string | undefined;
  try {
    requested = await rootLocale();
  } catch {
    requested = await requestLocale;
  }
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
