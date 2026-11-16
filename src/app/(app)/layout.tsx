import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { logOut } from "@/app/actions";
import { Brand } from "@/components/brand";
import { PlaceSwitcher } from "@/components/places/place-switcher";
import { requirePlace } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("Nav");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <header className="flex flex-col gap-3 px-5 pt-[18px]">
        <div className="flex items-center justify-between">
          <Brand />
          <form action={logOut}>
            <button
              type="submit"
              aria-label={t("logOut")}
              className="flex size-11 items-center justify-center rounded-[14px] border bg-card text-muted-foreground transition-colors active:bg-muted"
            >
              <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
          </form>
        </div>
        <Suspense fallback={<div className="h-[70px] animate-pulse rounded-[18px] bg-muted" />}>
          <CurrentPlace />
        </Suspense>
        {/* Stage C replaces these tabs with the place's own lists. */}
        <nav className="flex gap-1 overflow-x-auto">
          {(
            [
              ["/", "shopping"],
              ["/chores", "chores"],
              ["/history", "history"],
              ["/settings", "settings"],
            ] as const
          ).map(([href, key]) => (
            <Link
              key={href}
              href={href}
              className="flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t(key)}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex flex-1 flex-col gap-4 px-5 py-4">{children}</main>
    </div>
  );
}

async function CurrentPlace() {
  const { place, places } = await requirePlace();
  return <PlaceSwitcher current={place} places={places} />;
}
