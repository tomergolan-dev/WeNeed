import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { isGoogleConfigured } from "@/lib/google";
import { LoginForm } from "./login-form";

const LINK_ERRORS = ["googleFailed", "notAllowed"] as const;
type LinkError = (typeof LINK_ERRORS)[number];

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
      </div>
    </main>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  // Set by the Google callback when it sends the user back here.
  const { error } = await searchParams;
  const linkError = LINK_ERRORS.find((e) => e === error) ?? null;
  return <LoginForm google={isGoogleConfigured()} initialError={linkError satisfies LinkError | null} />;
}
