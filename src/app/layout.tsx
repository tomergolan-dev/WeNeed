import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { DirectionProvider } from "@/components/ui/direction";
import { locale } from "@/i18n/request";
import "./globals.css";

const fontSans = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-sans",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  // The cover shown when a link to the app is shared (WhatsApp, iMessage, etc.).
  const cover = { url: "/og.png", width: 1200, height: 630, alt: t("ogAlt") };
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: t("title"),
    description: t("description"),
    openGraph: {
      type: "website",
      siteName: "WeNeed",
      locale: "he_IL",
      title: t("title"),
      description: t("description"),
      images: [cover],
    },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description"), images: [cover] },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={locale}
      dir="rtl"
      className={`${fontSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <DirectionProvider direction="rtl">{children}</DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
