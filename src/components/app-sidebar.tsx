import { Sidebar } from "@/components/sidebar";
import { getCurrentUser } from "@/lib/auth";
import { getNav } from "@/lib/nav";

/** The wide-screen sidebar for a signed-in user: their urgent tasks, and every place they belong to with its lists. */
export async function AppSidebar() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { groups, currentId, urgent } = await getNav(user);
  return (
    <Sidebar
      groups={groups}
      currentId={currentId}
      urgent={urgent}
      user={{ name: user.name, email: user.email, taskEmails: user.taskEmails, avatar: user.avatar }}
    />
  );
}
