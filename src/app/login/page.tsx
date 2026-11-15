import { getTranslations } from "next-intl/server";

export default async function LoginPage() {
  const t = await getTranslations("Login");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 p-4 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("instructions")}</p>
    </main>
  );
}
