import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logOut } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("Nav");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <nav className="flex flex-1 gap-1">
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("shopping")}
          </Link>
          <Link href="/history" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("history")}
          </Link>
          <Link href="/settings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("settings")}
          </Link>
        </nav>
        <form action={logOut}>
          <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground">
            {t("logOut")}
          </Button>
        </form>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
    </div>
  );
}
