"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { AccountPanel, type AccountUser } from "@/components/account-menu";
import { Avatar } from "@/components/avatar";
import { AboutApp, NavLists, type SidebarGroup, type UrgentTask } from "@/components/sidebar";
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
  user: AccountUser | null;
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
  // "החברים שלי" brings its own header with a way back.
  const [people, setPeople] = useState(false);
  const first = user?.name.trim().split(/\s+/)[0];

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setView("nav");
          setPeople(false);
        }
      }}
      // From the start side: the right in Hebrew. Swipe it back the same way.
      swipeDirection={rtl ? "right" : "left"}
    >
      <DrawerTrigger
        aria-label={t("menu")}
        className={cn("flex min-w-0 items-center gap-2.5 rounded-full pe-2 transition-opacity active:opacity-80", className)}
      >
        <Avatar name={user?.name ?? null} avatar={user?.avatar} className="size-8 text-sm" />
        {first && (
          <span className="truncate text-[15px] font-semibold">
            {t("hi", { name: first })}
            <Greeting />
          </span>
        )}
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
                <Avatar name={user?.name ?? null} avatar={user?.avatar} className="size-10 text-base" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{user?.name ?? "WeNeed"}</span>
                  <span className="text-[13px] text-muted-foreground">{t("profile")}</span>
                </span>
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:-scale-x-100" aria-hidden />
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-4 pb-4">
                <NavLists {...nav} onNavigate={() => setOpen(false)} />
              </div>
              {/* Clear of the iPhone's rounded corner. */}
              <AboutApp
                onNavigate={() => setOpen(false)}
                className="ps-6 pe-4 pt-3 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]"
              />
            </>
          ) : (
            <>
              <div className={cn("flex items-center gap-2.5 px-4 pt-5 pb-4", people && "hidden")}>
                <button
                  type="button"
                  onClick={() => setView("nav")}
                  aria-label={t("back")}
                  className="-ms-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                >
                  <ArrowRight className="size-5 ltr:-scale-x-100" aria-hidden />
                </button>
                <DrawerTitle className="text-[15px] font-semibold">{t("profile")}</DrawerTitle>
              </div>
              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
                  people && "pt-5",
                )}
              >
                <AccountPanel user={user} flat onPeople={setPeople} />
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** The hour now on this device; null while rendering on the server, which doesn't know the user's clock. */
function useHour() {
  return useSyncExternalStore(
    noSubscribe,
    () => new Date().getHours(),
    () => null,
  );
}
const noSubscribe = () => () => {};

/** ", בוקר טוב" after "היי תומר": from 5, "צהריים טובים" from 12, "ערב טוב" from 17 and "לילה טוב" from 21, by the device's clock. */
function Greeting() {
  const t = useTranslations("Nav");
  const hour = useHour();
  if (hour === null) return null;
  const key = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "night";
  return <>, {t(key)}</>;
}
