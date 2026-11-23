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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-[18px]">
      <header className="flex items-center justify-between">
        <Link href="/">
          <Brand />
        </Link>
        <LanguageSwitch />
      </header>
      <h1 className="mt-8 text-[22px] font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("updated")}</p>
      <p className="mt-5 leading-7">{t("intro")}</p>

      <div className="mt-6 flex flex-col gap-3">
        {SECTIONS.map((key) => (
          <section key={key} className="rounded-[18px] border bg-card p-4 shadow-soft">
            <h2 className="font-bold">{t(`sections.${key}.title`)}</h2>
            <p className="mt-1.5 text-[15px] leading-7 text-muted-foreground">{t(`sections.${key}.body`)}</p>
          </section>
        ))}
        <section className="rounded-[18px] border bg-card p-4 shadow-soft">
          <h2 className="font-bold">{t("contact")}</h2>
          <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="mt-1.5 inline-block font-medium text-accent-foreground underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </section>
      </div>

      <Link href="/" className="mt-8 mb-4 text-center text-sm font-semibold text-accent-foreground">
        {t("back")}
      </Link>
    </main>
  );
}
