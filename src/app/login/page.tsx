import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getTranslations("Login");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-[18px]">
      <header>
        <Brand />
      </header>
      <div className="flex flex-1 flex-col justify-center pb-10">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("subtitle")}</p>
        <LoginForm />
      </div>
    </main>
  );
}
