import type { Metadata } from "next";
import { Noto_Sans_Hebrew } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { DirectionProvider } from "@/components/ui/direction";
import { locale } from "@/i18n/request";
import "./globals.css";

const fontSans = Noto_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  variable: "--font-sans",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("title"), description: t("description") };
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
