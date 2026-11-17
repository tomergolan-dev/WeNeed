"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { switchPlace } from "@/app/actions";
import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";
import { NewListButton } from "@/components/lists/new-list-button";
import { PlaceBadge } from "@/components/places/place-badge";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
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

/**
 * On a wide screen: the user's places and their lists beside the screen, so
 * moving between lists takes one click. Hidden on phones, which keep the
 * home screen.
 */
export function Sidebar({
  groups,
  currentId,
  base = "",
  switchable = true,
  footer,
}: {
  groups: SidebarGroup[];
  /** The place new lists go to; its home is the home screen. */
  currentId: string;
  /** "/demo" in the demo. */
  base?: string;
  /** False in the demo, which has one place. */
  switchable?: boolean;
  footer?: React.ReactNode;
}) {
  const t = useTranslations("Home");
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const home = base || "/";

  function openPlace(id: string) {
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
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-e bg-card lg:flex">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link href={home} aria-label="WeNeed">
          <Brand />
        </Link>
        <LanguageSwitch />
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
        {groups.map((group) => {
          const current = group.id === currentId;
          const atHome = current && pathname === home;
          return (
            <section key={group.id} className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => openPlace(group.id)}
                aria-current={atHome ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-2 py-1.5 text-start text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted",
                  atHome && "text-foreground",
                )}
              >
                <PlaceBadge icon={group.icon} className="size-6 [&>svg]:size-3.5" />
                <span className="truncate">{group.name}</span>
              </button>
              <ul className="flex flex-col gap-0.5">{group.lists.map(row)}</ul>
              {group.shared && group.shared.length > 0 && (
                <>
                  <p className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{t("sharedWithMe")}</p>
                  <ul className="flex flex-col gap-0.5">{group.shared.map(row)}</ul>
                </>
              )}
              {current && (
                <div className="px-2 pt-1">
                  <NewListButton />
                </div>
              )}
            </section>
          );
        })}
      </nav>
      {footer}
    </aside>
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
