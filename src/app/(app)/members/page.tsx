import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { MembersManager } from "@/components/places/members-manager";
import { requirePlace } from "@/lib/auth";
import { getPlaceInvites } from "@/lib/invites";
import { getPlace, getPlaceLists } from "@/lib/lists";

export default async function MembersPage() {
  const t = await getTranslations("Members");
  return (
    <>
      <Suspense fallback={<PageHeader title={t("title")} back="/settings" />}>
        <Header />
      </Suspense>
      <main className="px-5 pt-4 pb-8">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-3xl bg-muted" />}>
          <Members />
        </Suspense>
      </main>
    </>
  );
}

async function Header() {
  const [t, { place }] = await Promise.all([getTranslations("Members"), requirePlace()]);
  return <PageHeader title={t("title")} subtitle={place.personal ? undefined : place.name} back="/settings" />;
}

async function Members() {
  const { user, place } = await requirePlace();
  // A personal area is shared list by list, from each list's menu.
  if (place.personal) redirect("/");

  const [format, details, invites, lists] = await Promise.all([
    getFormatter(),
    getPlace(place.id),
    getPlaceInvites(place.id),
    getPlaceLists(place.id, user.id),
  ]);
  if (!details) redirect("/");
  const now = new Date();

  return (
    <MembersManager
      userId={user.id}
      admin={place.role === "owner"}
      members={details.members.map(({ id, name, role, allLists, lists: seen }) => ({ id, name, role, allLists, lists: seen }))}
      invites={invites.map((i) => ({ id: i.id, email: i.email, lists: i.lists?.map((l) => l.name) ?? null, when: format.relativeTime(i.createdAt, now) }))}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
    />
  );
}
