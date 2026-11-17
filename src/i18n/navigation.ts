import { createNavigation } from "next-intl/navigation";
import { getLocale } from "next-intl/server";
import { routing } from "./routing";

// Locale-aware versions of Next's navigation: links and redirects keep "/en".
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

/** Redirects to a path in the current request's language. */
export async function redirectTo(href: string): Promise<never> {
  return redirect({ href, locale: await getLocale() });
}
