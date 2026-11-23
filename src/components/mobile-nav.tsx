"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronLeft, Settings } from "lucide-react";
import { AccountPanel } from "@/components/account-menu";
import { Avatar } from "@/components/avatar";
import { NavLists, type SidebarGroup, type UrgentTask } from "@/components/sidebar";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * The phone's menu, like Spotify's: the user's badge and "Hi Tomer" atop the
 * home screen open a panel from the side with what the wide screen's sidebar
 * shows (urgent tasks, every place and its lists), and the user's own
 * settings one tap further in.
 */
export function MobileNav({
  user,
  className,
  ...nav
}: {
  /** Null in the demo. */
  user: { name: string; email: string | null; taskEmails: boolean } | null;
  groups: SidebarGroup[];
  currentId: string;
  urgent?: UrgentTask[];
  base?: string;
  switchable?: boolean;
  className?: string;
}) {
  const t = useTranslations("Nav");
  const rtl = useLocale() === "he";
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"nav" | "account">("nav");
  const first = user?.name.trim().split(/\s+/)[0];

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView("nav");
      }}
      // From the start side: the right in Hebrew. Swipe it back the same way.
      swipeDirection={rtl ? "right" : "left"}
    >
      <DrawerTrigger
        aria-label={t("menu")}
        className={cn("flex min-w-0 items-center gap-2.5 rounded-full pe-2 transition-opacity active:opacity-80", className)}
      >
        <Avatar name={user?.name ?? null} />
        {first && <span className="truncate text-[17px] font-semibold">{t("hi", { name: first })}</span>}
      </DrawerTrigger>
      <DrawerContent
        className={cn(
          "rounded-none! rounded-e-[24px]! border-0! bg-card after:hidden! [--drawer-content-width:min(20rem,85vw)]!",
          // The drawer places a "right" panel at the end side, which is the left in Hebrew.
          rtl && "right-0! left-auto!",
        )}
      >
        <div className="flex h-full min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
          {view === "nav" ? (
            <>
              <DrawerTitle className="sr-only">{t("menu")}</DrawerTitle>
              <button
                type="button"
                onClick={() => setView("account")}
                className="flex items-center gap-3 border-b border-border/60 px-4 pt-5 pb-4 text-start active:bg-muted"
              >
                <Avatar name={user?.name ?? null} className="size-12 text-xl" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[17px] font-semibold">{user?.name ?? "WeNeed"}</span>
                  <span className="text-[13px] text-muted-foreground">{t("profile")}</span>
                </span>
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:-scale-x-100" aria-hidden />
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                <NavLists {...nav} onNavigate={() => setOpen(false)} />
              </div>
              <button
                type="button"
                onClick={() => setView("account")}
                className="flex items-center gap-3 border-t border-border/60 px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] text-[15px] active:bg-muted"
              >
                <Settings className="size-[18px] text-muted-foreground" aria-hidden />
                {t("settings")}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
                <button
                  type="button"
                  onClick={() => setView("nav")}
                  aria-label={t("back")}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground active:bg-muted"
                >
                  <ArrowRight className="size-[18px] ltr:-scale-x-100" aria-hidden />
                </button>
                <DrawerTitle className="text-[17px] font-semibold">{t("profile")}</DrawerTitle>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <AccountPanel user={user} />
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
