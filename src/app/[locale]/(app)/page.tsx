import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { LogOut, Settings } from "lucide-react";
import { logOut } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { Brand } from "@/components/brand";
import { NewListButton } from "@/components/lists/new-list-button";
import { PlaceSwitcher } from "@/components/places/place-switcher";
import { requirePlace } from "@/lib/auth";
import { getInvitesFor } from "@/lib/invites";
import { getPlaceLists, getSharedWithMe } from "@/lib/lists";
import { ListCard } from "@/components/lists/list-card";
import { InviteBanner } from "@/components/places/invite-banner";
import { LanguageSwitch } from "@/components/language-switch";

const iconButton =
  "flex size-10 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors active:bg-muted";

export default async function HomePage() {
  const t = await getTranslations("Nav");

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background px-5 pt-[18px] pb-2 lg:static lg:px-8 lg:pt-6">
        <span className="lg:invisible">
          <Brand />
        </span>
        <div className="flex items-center gap-2">
          <LanguageSwitch className="lg:hidden" />
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
      <main className="flex flex-1 flex-col px-5 pt-3 pb-8 lg:px-8">
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
        <ul className="grid gap-2.5 lg:grid-cols-2">
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
          <ul className="grid gap-2.5 lg:grid-cols-2">
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
