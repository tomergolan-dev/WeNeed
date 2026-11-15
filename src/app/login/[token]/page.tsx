import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LoginButton } from "./login-button";

// The token is consumed only when the button is pressed (a POST), so link
// previews in WhatsApp, which fetch the page with GET, can't burn it.
export default async function LoginLinkPage({ params }: PageProps<"/login/[token]">) {
  const t = await getTranslations("Login");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">{t("linkTitle")}</h1>
      <p className="text-muted-foreground">{t("linkDescription")}</p>
      <Suspense>
        <TokenLoginButton params={params} />
      </Suspense>
    </main>
  );
}

async function TokenLoginButton({ params }: Pick<PageProps<"/login/[token]">, "params">) {
  const { token } = await params;
  return <LoginButton token={token} />;
}
