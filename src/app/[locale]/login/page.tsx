import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";
import { isGoogleConfigured } from "@/lib/google";
import { LIST_KINDS, LIST_TYPES } from "@/lib/list-kinds";
import { cn } from "@/lib/utils";
import { LoginForm } from "./login-form";

/** Phones: the sign-in form. Wide screens: the form beside a panel on what WeNeed is. */
export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const [t, tDemo] = await Promise.all([getTranslations("Login"), getTranslations("Demo")]);

  return (
    <div className="flex w-full flex-1">
      <main className="flex w-full flex-col px-5 pb-[18px] lg:w-1/2 lg:px-12 lg:py-8">
        {/* From the very top and edge to edge on a phone, so iOS doesn't blur what scrolls under the status bar. */}
        <header className="sticky top-0 z-20 -mx-5 bg-background px-5 pt-[18px] pb-2 lg:static lg:mx-0 lg:px-0 lg:pt-0 lg:pb-0">
          <div className="mx-auto flex w-full max-w-md items-center justify-between lg:max-w-none">
            <Brand />
            <div className="flex items-center gap-2">
              <Link
                href="/demo"
                dir="ltr"
                className="flex h-11 items-center gap-1 rounded-full border bg-card ps-4 pe-3 text-sm font-semibold tracking-wide text-accent-foreground transition-colors hover:bg-accent active:bg-accent"
              >
                {tDemo("view")}
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
              <LanguageSwitch className="rounded-full" />
            </div>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-10">
          <h1 className="text-[22px] font-extrabold tracking-tight lg:text-[28px]">{t("title")}</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground lg:invisible">{t("subtitle")}</p>
          <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-muted" />}>
            <Form searchParams={searchParams} />
          </Suspense>
          <Link href="/privacy" className="mt-6 text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
            {t("privacy")}
          </Link>
        </div>
      </main>
      <Panel />
    </div>
  );
}

/** Wide screens only: the slogan and the three kinds of lists, on the brand green. */
async function Panel() {
  const [t, tKinds] = await Promise.all([getTranslations("Login"), getTranslations("ListKinds")]);
  return (
    <aside className="sticky top-0 hidden h-dvh w-1/2 flex-col justify-center overflow-hidden bg-primary px-14 text-primary-foreground lg:flex">
      <div
        className="pointer-events-none absolute -end-40 -top-40 size-[520px] rounded-full bg-white/[0.06]"
        aria-hidden
      />
      <div className="pointer-events-none absolute -start-24 -bottom-48 size-[420px] rounded-full bg-white/[0.05]" aria-hidden />
      <div className="relative flex max-w-lg flex-col gap-8">
        <div>
          <p className="text-[44px] leading-[1.1] font-extrabold tracking-tight text-balance">{t("subtitle")}</p>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-white/80">{t("pitch")}</p>
        </div>
        <ul className="flex flex-col gap-3">
          {LIST_TYPES.map((type) => {
            const { icon: Icon, tone } = LIST_KINDS[type];
            return (
              <li key={type} className="flex items-center gap-3.5 rounded-[18px] bg-white/95 px-4 py-3.5 text-foreground shadow-lg shadow-black/10">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold">{tKinds(`${type}.name`)}</span>
                  <span className="text-[13px] text-muted-foreground">{tKinds(`${type}.description`)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/[locale]/login">, "searchParams">) {
  // Set by the Google callback when it sends the user back here.
  const { error } = await searchParams;
  return <LoginForm google={isGoogleConfigured()} initialError={error === "googleFailed" ? error : null} />;
}
