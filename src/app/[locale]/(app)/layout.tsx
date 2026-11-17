import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarSkeleton } from "@/components/sidebar";

/** Phones: one column. Wide screens: the places and lists in a sidebar, the screen beside it. */
export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="flex w-full flex-1">
      <Suspense fallback={<SidebarSkeleton />}>
        <AppSidebar />
      </Suspense>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col lg:max-w-3xl xl:max-w-4xl">{children}</div>
    </div>
  );
}
