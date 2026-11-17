import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogOut, Settings } from "lucide-react";
import { logOut } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { Brand } from "@/components/brand";
import { NewListButton } from "@/components/lists/new-list-button";
import { PlaceSwitcher } from "@/components/places/place-switcher";
import { requirePlace } from "@/lib/auth";
import { LIST_KINDS } from "@/lib/list-kinds";
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
  const attention = lists.reduce((sum, list) => sum + list.overdue + list.soon, 0);

  return (
    <>
      <AutoRefresh />
      <PlaceSwitcher current={place} places={places} />
      <div className="pt-6 pb-1">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("count", { count: lists.length })}
          {attention > 0 && ` · ${t("attention", { count: attention })}`}
        </p>
      </div>
      <div className="flex items-center justify-between px-1 pt-4 pb-2.5">
        <h2 className="text-[13px] font-semibold text-muted-foreground">{t("lists")}</h2>
        <NewListButton />
      </div>
      {lists.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-[#c3cbc7] px-4 py-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lists.map((list) => (
            <li key={list.id}>
              <ListCard list={list} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function ListCard({ list }: { list: ListSummary }) {
  const t = await getTranslations("Home");
  const { icon: Icon, tone } = LIST_KINDS[list.type];
  const open = list.total - list.done;

  let meta: React.ReactNode;
  let bar: string | null = null;
  if (list.type === "tasks") {
    meta = (
      <>
        <span>{t("choresOpen", { count: open })}</span>
        {list.overdue > 0 && <Pill className="bg-[#fdecea] text-[#b42318]">{t("overdue", { count: list.overdue })}</Pill>}
        {list.soon > 0 && <Pill className="bg-[#fff3d6] text-[#8a5a00]">{t("soon", { count: list.soon })}</Pill>}
      </>
    );
  } else if (list.total === 0) {
    meta = t("listEmpty");
  } else if (list.type === "checklist") {
    meta = t("checked", { done: list.done, total: list.total });
    bar = "bg-[#c9962a]";
  } else {
    meta = list.done > 0 ? t("itemsInCart", { count: list.total, done: list.done }) : t("items", { count: list.total });
    bar = "bg-primary";
  }

  return (
    <Link
      href={`/lists/${list.id}`}
      className="flex items-center gap-3 rounded-[18px] border bg-card py-3.5 ps-3 pe-3.5 shadow-soft transition-colors active:bg-muted"
    >
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{list.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">{meta}</span>
        {bar && list.total > 0 && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#eef1f0]">
            <span className={cn("block h-full rounded-full", bar)} style={{ width: `${(list.done / list.total) * 100}%` }} />
          </span>
        )}
      </span>
    </Link>
  );
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center rounded-full px-2 text-xs font-semibold", className)}>
      {children}
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
