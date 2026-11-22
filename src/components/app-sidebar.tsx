import { getTranslations } from "next-intl/server";
import { Sidebar } from "@/components/sidebar";
import { getCurrentPlace, getCurrentUser } from "@/lib/auth";
import { getPlaceLists, getSharedWithMe } from "@/lib/lists";

/** The wide-screen sidebar for a signed-in user: every place they belong to, with its lists. */
export async function AppSidebar() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [t, { place, places }] = await Promise.all([getTranslations("Places"), getCurrentPlace(user.id)]);
  const [lists, shared] = await Promise.all([
    Promise.all(places.map((p) => getPlaceLists(p.id, user.id))),
    getSharedWithMe(user.id),
  ]);
  const groups = places.map((p, i) => ({
    id: p.id,
    name: p.personal ? t("personal") : p.name,
    icon: p.icon,
    lists: lists[i],
    shared: p.personal ? shared : undefined,
  }));
  return <Sidebar groups={groups} currentId={place.id} user={{ name: user.name, email: user.email, taskEmails: user.taskEmails }} />;
}
