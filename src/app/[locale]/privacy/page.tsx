import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";

// Public: linked from the login page and from the Google sign-in consent screen.
const CONTACT_EMAIL = "tomergolan01@gmail.com";
const SECTIONS = ["collect", "use", "services", "cookies", "demo", "delete"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Privacy");
  return { title: `${t("title")} · WeNeed` };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-2.5 pb-8">
      {/* Stays put on a solid background, so iOS tints the status bar instead of blurring what scrolls under it. */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background py-2">
        <Link href="/">
          <Brand />
        </Link>
        <LanguageSwitch />
      </header>
      <h1 className="mt-7 text-xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{t("updated")}</p>
      <p className="mt-4 text-[15px] leading-7">{t("intro")}</p>

      <div className="mt-5 flex flex-col gap-2.5">
        {SECTIONS.map((key) => (
          <section key={key} className="rounded-2xl border border-border/60 bg-card p-4">
            <h2 className="text-[15px] font-semibold">{t(`sections.${key}.title`)}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(`sections.${key}.body`)}</p>
          </section>
        ))}
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <h2 className="text-[15px] font-semibold">{t("contact")}</h2>
          <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="mt-1 inline-block text-sm font-medium text-accent-foreground underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </section>
      </div>

      <Link href="/" className="mt-7 text-center text-sm font-medium text-accent-foreground">
        {t("back")}
      </Link>
    </main>
  );
}
