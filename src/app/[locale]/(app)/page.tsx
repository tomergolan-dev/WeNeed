import { Suspense } from "react";
import { Settings } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { MobileNav } from "@/components/mobile-nav";
import { NewListButton } from "@/components/lists/new-list-button";
import { PlaceSwitcher } from "@/components/places/place-switcher";
import { getCurrentUser, requirePlace } from "@/lib/auth";
import { getInvitesFor } from "@/lib/invites";
import { getPlaceLists, getSharedWithMe } from "@/lib/lists";
import { getNav } from "@/lib/nav";
import { ListCard } from "@/components/lists/list-card";
import { InviteBanner } from "@/components/places/invite-banner";

export default async function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background px-5 pt-[18px] pb-2 lg:static lg:px-8 lg:pt-6">
        <Suspense fallback={<span className="size-8 rounded-full bg-muted lg:invisible" />}>
          <Menu />
        </Suspense>
      </header>
      <main className="flex flex-1 flex-col px-5 pt-3 pb-8 lg:px-8">
        <Suspense fallback={<HomeSkeleton />}>
          <Home />
        </Suspense>
      </main>
    </>
  );
}

/** Phones: the user's badge, which opens the side menu. Wide screens have the sidebar instead. */
async function Menu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { groups, currentId, urgent } = await getNav(user);
  return (
    <MobileNav
      user={{ name: user.name, email: user.email, taskEmails: user.taskEmails, avatar: user.avatar }}
      groups={groups}
      currentId={currentId}
      urgent={urgent}
      className="lg:invisible"
    />
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
      <div className="flex items-center justify-between gap-3 pt-6 pb-1">
        <h1 className="text-xl font-extrabold tracking-tight">{t("title")}</h1>
        {/* A shared place's settings; the personal area has none. */}
        {!place.personal && (
          <Link
            href="/settings"
            aria-label={t("placeSettings")}
            title={t("placeSettings")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
          >
            <Settings className="size-[18px]" aria-hidden />
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between px-1 pt-4 pb-2.5">
        <h2 className="text-[13px] font-semibold text-muted-foreground">{place.personal ? t("myLists") : t("lists")}</h2>
        <NewListButton />
      </div>
      {lists.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#c3cbc7] px-4 py-6 text-center text-sm text-muted-foreground">
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
      <div className="h-[70px] animate-pulse rounded-2xl bg-muted" />
      <div className="mt-6 h-9 w-48 animate-pulse rounded-lg bg-muted" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}
