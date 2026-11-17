import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

/** Lets phones add the app to the home screen with its own name and icon. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // One manifest for the whole site, in the default language; the app itself
  // opens in the language the visitor last chose.
  const locale = routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    name: "WeNeed",
    short_name: "WeNeed",
    description: t("description"),
    lang: locale,
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#fafbfa",
    theme_color: "#16835f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
