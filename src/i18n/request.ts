import { getRequestConfig } from "next-intl/server";

// The app is Hebrew-only, so there is no locale routing.
export const locale = "he";
export const timeZone = "Asia/Jerusalem";

export default getRequestConfig(async () => ({
  locale,
  timeZone,
  messages: (await import(`../../messages/${locale}.json`)).default,
}));
