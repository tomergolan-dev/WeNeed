"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlarmClock } from "lucide-react";
import { switchPlace } from "@/app/actions";
import { Brand, LogoMark } from "@/components/brand";
import { AccountMenu, type AccountUser } from "@/components/account-menu";
import { NewListButton } from "@/components/lists/new-list-button";
import { PlaceBadge } from "@/components/places/place-badge";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { dueStatus } from "@/lib/due";
import { LIST_KINDS } from "@/lib/list-kinds";
import type { ListSummary } from "@/lib/lists";
import { cn } from "@/lib/utils";

export type SidebarList = Pick<ListSummary, "id" | "name" | "type" | "total" | "done" | "overdue" | "soon">;

export type SidebarGroup = {
  id: string;
  name: string;
  icon: string;
  lists: SidebarList[];
  /** Lists others shared with the user, shown under the personal area. */
  shared?: SidebarList[];
};

/** An open task of the user's (or nobody's) that is late or due within a day. */
export type UrgentTask = {
  id: string;
  name: string;
  listId: string;
  listName: string;
  dueDate: string | null;
  dueTime: string | null;
};

type NavProps = {
  groups: SidebarGroup[];
  /** The place new lists go to; its home is the home screen. */
  currentId: string;
  urgent?: UrgentTask[];
  /** "/demo" in the demo. */
  base?: string;
  /** False in the demo, which has one place. */
  switchable?: boolean;
  /** Called after a tap that leaves the menu, so the phone's menu can close. */
  onNavigate?: () => void;
};

/**
 * On a wide screen: the user's places and their lists beside the screen, so
 * moving between lists takes one click. On a phone the same opens from the
 * home screen (see MobileNav).
 */
export function Sidebar({
  user = null,
  ...nav
}: NavProps & {
  /** For the account menu; null in the demo. */
  user?: AccountUser | null;
}) {
  const home = nav.base || "/";
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-e bg-card lg:flex">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link href={home} aria-label="WeNeed">
          <Brand />
        </Link>
        <AccountMenu user={user} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <NavLists {...nav} />
      </div>
      {/* The logo is already at the top here. */}
      <AboutApp logo={false} className="px-4 py-3" />
    </aside>
  );
}

/** Quietly at the bottom of the side menu: the logo, the privacy policy and who made the app. */
export function AboutApp({
  logo = true,
  onNavigate,
  className,
}: {
  logo?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const t = useTranslations("Nav");
  return (
    <footer className={cn("flex flex-col gap-1 border-t border-border/60", className)}>
      {logo && (
        <span className="flex items-center gap-1.5">
          <LogoMark className="size-5" />
          <span dir="ltr" className="text-[13px] font-bold tracking-tight">
            WeNeed
          </span>
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        <Link href="/privacy" onClick={onNavigate} className="underline-offset-2 hover:underline active:underline">
          {t("privacy")}
        </Link>
        {" · "}
        {t("madeBy")}
      </span>
    </footer>
  );
}

/** What the side menu lists: urgent tasks first, then each place with its lists. */
export function NavLists({ groups, currentId, urgent = [], base = "", switchable = true, onNavigate }: NavProps) {
  const t = useTranslations("Home");
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const home = base || "/";

  function openPlace(id: string) {
    onNavigate?.();
    startTransition(async () => {
      if (switchable && id !== currentId) await switchPlace(id);
      router.push(home);
    });
  }

  const row = (list: SidebarList) => {
    const href = `${base}/lists/${list.id}`;
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const { icon: Icon, tone } = LIST_KINDS[list.type];
    return (
      <li key={list.id}>
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted",
            active && "bg-accent font-semibold text-accent-foreground hover:bg-accent",
          )}
        >
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", tone)}>
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate">{list.name}</span>
          <Count list={list} />
        </Link>
      </li>
    );
  };

  return (
    <nav className="flex flex-col gap-4">
      {urgent.length > 0 && <Urgent tasks={urgent} base={base} onNavigate={onNavigate} />}
      {groups.map((group) => {
        const current = group.id === currentId;
        const atHome = current && pathname === home;
        return (
          <section key={group.id} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openPlace(group.id)}
                aria-current={atHome ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-start text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted",
                  atHome && "text-foreground",
                )}
              >
                <PlaceBadge icon={group.icon} className="size-6 [&>svg]:size-3.5" />
                <span className="truncate">{group.name}</span>
              </button>
              <NewListButton
                place={group.name}
                beforeCreate={switchable && !current ? () => switchPlace(group.id).then(() => {}) : undefined}
              />
            </div>
            <ul className="flex flex-col gap-0.5">{group.lists.map(row)}</ul>
            {group.shared && group.shared.length > 0 && (
              <>
                <p className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{t("sharedWithMe")}</p>
                <ul className="flex flex-col gap-0.5">{group.shared.map(row)}</ul>
              </>
            )}
          </section>
        );
      })}
    </nav>
  );
}

/**
 * "דחוף": the user's tasks (theirs or nobody's) that are late or due within a
 * day, from every list, as quiet rows like the lists below ("להחליף נורה ·
 * מטלות הבית"): a red dot for late, an amber one for soon. Each opens its list.
 */
function Urgent({ tasks, base, onNavigate }: { tasks: UrgentTask[]; base: string; onNavigate?: () => void }) {
  const t = useTranslations("Nav");
  // As of opening the menu.
  const [now] = useState(() => Date.now());
  return (
    <section className="flex flex-col gap-0.5">
      <h2 className="flex items-center gap-2 px-2 py-1.5 text-[13px] font-semibold text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-full bg-[#fdecea] text-[#b42318]" aria-hidden>
          <AlarmClock className="size-3.5" />
        </span>
        {t("urgent")}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {tasks.map((task) => {
          const late = dueStatus({ ...task, done: false }, now) === "overdue";
          return (
            <li key={task.id}>
              <Link
                href={`${base}/lists/${task.listId}`}
                onClick={onNavigate}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="flex size-7 shrink-0 items-center justify-center" aria-hidden>
                  <span suppressHydrationWarning className={cn("size-2 rounded-full", late ? "bg-[#d9452f]" : "bg-[#e0a21b]")} />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {task.name}
                  <span className="text-muted-foreground"> · {task.listName}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** What is left in a list, at a glance: open items, tasks needing attention, or checked out of all. */
function Count({ list }: { list: SidebarList }) {
  const t = useTranslations("Home");
  if (list.type === "tasks" && list.overdue > 0) {
    return (
      <span className="rounded-full bg-[#fdecea] px-1.5 text-[11px] font-semibold text-[#b42318]">
        {t("overdue", { count: list.overdue })}
      </span>
    );
  }
  if (list.type === "tasks" && list.soon > 0) {
    return (
      <span className="rounded-full bg-[#fff3d6] px-1.5 text-[11px] font-semibold text-[#8a5a00]">
        {t("soon", { count: list.soon })}
      </span>
    );
  }
  const text = list.type === "checklist" ? `${list.done}/${list.total}` : list.total - list.done;
  if (list.total === 0) return null;
  return <span className="text-xs text-muted-foreground tabular-nums">{text}</span>;
}

/** Holds the sidebar's place while it loads, so the screen doesn't shift. */
export function SidebarSkeleton() {
  return <div className="hidden h-dvh w-72 shrink-0 border-e bg-card lg:block" aria-hidden />;
}
