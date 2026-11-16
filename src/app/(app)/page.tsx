import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ListTodo, LogOut, Settings, ShoppingCart } from "lucide-react";
import { logOut } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { Brand } from "@/components/brand";
import { NewListButton } from "@/components/lists/new-list-button";
import { PlaceSwitcher } from "@/components/places/place-switcher";
import { requirePlace } from "@/lib/auth";
import { TONES } from "@/lib/category-icons";
import { getPlaceLists, type ListSummary } from "@/lib/lists";
import { cn } from "@/lib/utils";

const iconButton =
  "flex size-11 items-center justify-center rounded-[14px] border bg-card text-muted-foreground transition-colors active:bg-muted";

export default async function HomePage() {
  const t = await getTranslations("Nav");

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[18px]">
        <Brand />
        <div className="flex items-center gap-2">
          <Link href="/settings" aria-label={t("settings")} className={iconButton}>
            <Settings className="size-5" aria-hidden />
          </Link>
          <form action={logOut}>
            <button type="submit" aria-label={t("logOut")} className={iconButton}>
              <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col px-5 pt-3 pb-8">
        <Suspense fallback={<HomeSkeleton />}>
          <Home />
        </Suspense>
      </main>
    </>
  );
}

async function Home() {
  const { place, places } = await requirePlace();
  const [t, lists] = await Promise.all([getTranslations("Home"), getPlaceLists(place.id)]);
  const shopping = lists.filter((list) => list.type === "shopping");
  // Chores stay one list per place until Stage D; show it even before the first chore.
  const chores = lists.find((list) => list.type === "tasks");

  return (
    <>
      <AutoRefresh />
      <PlaceSwitcher current={place} places={places} />
      <div className="pt-6 pb-1">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("count", { count: shopping.length })}</p>
      </div>
      <div className="flex items-center justify-between px-1 pt-4 pb-2.5">
        <h2 className="text-[13px] font-semibold text-muted-foreground">{t("lists")}</h2>
        <NewListButton />
      </div>
      <ul className="flex flex-col gap-2.5">
        {shopping.map((list, index) => (
          <li key={list.id}>
            <ShoppingCard list={list} tone={TONES[index % TONES.length]} />
          </li>
        ))}
        {shopping.length === 0 && (
          <li className="rounded-[18px] border border-dashed border-[#c3cbc7] px-4 py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </li>
        )}
        <li>
          <Link href="/chores" className={card}>
            <Badge tone="bg-[#f0ecf7] text-[#6a5794]" icon={ListTodo} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{t("chores")}</span>
              <span className="text-[13px] text-muted-foreground">
                {t("choresOpen", { count: chores ? chores.total - chores.done : 0 })}
              </span>
            </span>
          </Link>
        </li>
      </ul>
    </>
  );
}

const card =
  "flex items-center gap-3 rounded-[18px] border bg-card py-3.5 ps-3 pe-3.5 shadow-soft transition-colors active:bg-muted";

async function ShoppingCard({ list, tone }: { list: ListSummary; tone: string }) {
  const t = await getTranslations("Home");
  return (
    <Link href={`/lists/${list.id}`} className={card}>
      <Badge tone={tone} icon={ShoppingCart} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{list.name}</span>
        <span className="text-[13px] text-muted-foreground">
          {list.total === 0
            ? t("listEmpty")
            : list.done > 0
              ? t("itemsInCart", { count: list.total, done: list.done })
              : t("items", { count: list.total })}
        </span>
        {list.total > 0 && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#eef1f0]">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(list.done / list.total) * 100}%` }}
            />
          </span>
        )}
      </span>
    </Link>
  );
}

function Badge({ tone, icon: Icon }: { tone: string; icon: typeof ShoppingCart }) {
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      <div className="h-[70px] animate-pulse rounded-[18px] bg-muted" />
      <div className="mt-6 h-9 w-48 animate-pulse rounded-lg bg-muted" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-[74px] animate-pulse rounded-[18px] bg-muted" />
      ))}
    </div>
  );
}
