import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { isGoogleConfigured } from "@/lib/google";
import { LoginForm } from "./login-form";


export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("Login");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-[18px]">
      <header>
        <Brand />
      </header>
      <div className="flex flex-1 flex-col justify-center pb-10">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("subtitle")}</p>
        <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-muted" />}>
          <Form searchParams={searchParams} />
        </Suspense>
        <Link href="/privacy" className="mt-6 text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
          {t("privacy")}
        </Link>
      </div>
    </main>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  // Set by the Google callback when it sends the user back here.
  const { error } = await searchParams;
  return <LoginForm google={isGoogleConfigured()} initialError={error === "googleFailed" ? error : null} />;
}
