import { getRequestConfig } from "next-intl/server";

// The app is Hebrew-only, so there is no locale routing.
export const locale = "he";

export default getRequestConfig(async () => ({
  locale,
  messages: (await import(`../../messages/${locale}.json`)).default,
}));
