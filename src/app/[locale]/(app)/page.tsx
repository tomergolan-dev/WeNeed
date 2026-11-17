import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Lock, LogOut, Settings } from "lucide-react";
import { logOut } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { Brand } from "@/components/brand";
import { NewListButton } from "@/components/lists/new-list-button";
import { PlaceSwitcher } from "@/components/places/place-switcher";
import { requirePlace } from "@/lib/auth";
import { LIST_KINDS } from "@/lib/list-kinds";
import { getInvitesFor } from "@/lib/invites";
import { getPlaceLists, getSharedWithMe, type ListSummary } from "@/lib/lists";
import { MiniInitials } from "@/components/people";
import { InviteBanner } from "@/components/places/invite-banner";
import { LanguageSwitch } from "@/components/language-switch";
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
          <LanguageSwitch />
          <Suspense>
            <SettingsLink label={t("settings")} />
          </Suspense>
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

/** Settings belong to a shared place; the personal area has none. */
async function SettingsLink({ label }: { label: string }) {
  const { place } = await requirePlace();
  if (place.personal) return null;
  return (
    <Link href="/settings" aria-label={label} className={iconButton}>
      <Settings className="size-5" aria-hidden />
    </Link>
  );
}

async function Home() {
  const { user, place, places } = await requirePlace();
  const [t, lists, shared, invites] = await Promise.all([
    getTranslations("Home"),
    getPlaceLists(place.id, user.id),
    place.personal ? getSharedWithMe(user.id) : Promise.resolve([]),
    user.email ? getInvitesFor(user.email) : Promise.resolve([]),
  ]);
  const sharedCount = place.personal ? shared.length : (await getSharedWithMe(user.id)).length;
  const attention = [...lists, ...shared].reduce((sum, list) => sum + list.overdue + list.soon, 0);
  const banners = invites.map((invite) => <InviteBanner key={invite.id} invite={invite} />);

  return (
    <>
      <AutoRefresh />
      <PlaceSwitcher
        current={place}
        places={places}
        sharedWithMe={sharedCount}
        invites={banners.length > 0 ? banners : undefined}
      />
      {banners.length > 0 && <div className="mt-3 flex flex-col gap-2.5">{banners}</div>}
      <div className="pt-6 pb-1">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {place.personal ? t("personalSubtitle") : t("count", { count: lists.length })}
          {attention > 0 && ` · ${t("attention", { count: attention })}`}
        </p>
      </div>
      <div className="flex items-center justify-between px-1 pt-4 pb-2.5">
        <h2 className="text-[13px] font-semibold text-muted-foreground">{place.personal ? t("myLists") : t("lists")}</h2>
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
              <ListCard list={list} personal={place.personal} />
            </li>
          ))}
        </ul>
      )}
      {shared.length > 0 && (
        <>
          <h2 className="px-1 pt-6 pb-2.5 text-[13px] font-semibold text-muted-foreground">{t("sharedWithMe")}</h2>
          <ul className="flex flex-col gap-2.5">
            {shared.map((list) => (
              <li key={list.id}>
                <ListCard list={list} personal={false} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

async function ListCard({ list, personal }: { list: ListSummary; personal: boolean }) {
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

  // Who sees it: in my personal area, "only me" or who it is shared with;
  // someone else's list, whose it is; in a shared place, a lock when not open to all.
  let access: React.ReactNode = null;
  if (personal) {
    access =
      list.sharedWith.length === 0 ? (
        <>
          <Lock className="size-3.5" aria-hidden />
          {t("onlyMe")} ·
        </>
      ) : (
        <>
          <MiniInitials names={list.sharedWith} />
          {t("sharedWith", { names: list.sharedWith.join(", ") })} ·
        </>
      );
  } else if (list.ownerName) {
    access = <>{t("from", { name: list.ownerName })} ·</>;
  } else if (list.visibility === "selected") {
    access = <Lock className="size-3.5" aria-label={t("onlySome")} />;
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
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
          {access}
          {meta}
        </span>
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
