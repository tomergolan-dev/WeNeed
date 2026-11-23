import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { DirectionProvider } from "@/components/ui/direction";
import { PortraitOnly } from "@/components/portrait-only";
import { directionOf, routing } from "@/i18n/routing";
import "../globals.css";

const fontSans = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-sans",
});

// An app screen, not a page to zoom: no zooming in when a field is tapped
// (iOS zooms into text under 16px) and no zooming out.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  const locale = await rootLocale();
  // The cover shown when a link to the app is shared (WhatsApp, iMessage, etc.).
  // Bump ?v= when the image changes, so apps that cached the old one fetch it again.
  const cover = { url: locale === "en" ? "/og-en.png?v=2" : "/og.png?v=2", width: 1200, height: 630, alt: t("ogAlt") };
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: t("title"),
    description: t("description"),
    openGraph: {
      type: "website",
      siteName: "WeNeed",
      locale: locale === "en" ? "en_US" : "he_IL",
      title: t("title"),
      description: t("description"),
      images: [cover],
    },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description"), images: [cover] },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const dir = directionOf(locale);
  return (
    <html
      lang={locale}
      dir={dir}
      className={`${fontSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <DirectionProvider direction={dir}>{children}</DirectionProvider>
          <PortraitOnly />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
