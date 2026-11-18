import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { MiniInitials } from "@/components/people";
import { LIST_KINDS } from "@/lib/list-kinds";
import type { ListSummary } from "@/lib/lists";
import { cn } from "@/lib/utils";

/** A list on the home screen: its kind, progress, and who sees it. */
export function ListCard({ list, personal, href }: { list: ListSummary; personal: boolean; href?: string }) {
  const t = useTranslations("Home");
  const { icon: Icon, tone } = LIST_KINDS[list.type];
  const open = list.total - list.done;

  let meta: React.ReactNode;
  let bar: string | null = null;
  if (list.type === "tasks") {
    meta = (
      <>
        <span>{t("choresOpen", { count: open })}</span>
        {list.overdue > 0 && <Pill className="bg-[#fdecea] text-[#b42318]">{t("overdue", { count: list.overdue })}</Pill>}
        {list.soon > 0 && <Pill className="bg-[#fff3d6] text-[#8a5a00]">{t("soon", { count: list.soon })}</Pill>}
      </>
    );
  } else if (list.total === 0) {
    meta = t("listEmpty");
  } else if (list.type === "checklist") {
    meta = t("checked", { done: list.done, total: list.total });
    bar = "bg-[#c9962a]";
  } else {
    meta = list.done > 0 ? t("itemsInCart", { count: list.total, done: list.done }) : t("items", { count: list.total });
    bar = "bg-primary";
  }

  // Who sees it: in my personal area, "only me" or who it is shared with;
  // someone else's list, whose it is; in a shared place, a lock when not open to all.
  let access: React.ReactNode = null;
  if (personal) {
    access =
      list.sharedWith.length === 0 ? (
        <>
          <Lock className="size-3.5" aria-hidden />
          {t("onlyMe")}
          <Dot />
        </>
      ) : (
        <>
          <MiniInitials names={list.sharedWith} />
          {t("sharedWith", { names: list.sharedWith.join(", ") })}
          <Dot />
        </>
      );
  } else if (list.ownerName) {
    access = (
      <>
        {t("from", { name: list.ownerName })}
        <Dot />
      </>
    );
  } else if (list.visibility === "selected") {
    access = <Lock className="size-3.5" aria-label={t("onlySome")} />;
  }

  return (
    <Link
      href={href ?? `/lists/${list.id}`}
      className="flex items-center gap-3 rounded-[18px] border bg-card py-3.5 ps-3 pe-3.5 shadow-soft transition-colors active:bg-muted"
    >
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{list.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
          {access}
          {meta}
        </span>
        {bar && list.total > 0 && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#eef1f0]">
            <span className={cn("block h-full rounded-full", bar)} style={{ width: `${(list.done / list.total) * 100}%` }} />
          </span>
        )}
      </span>
    </Link>
  );
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center rounded-full px-2 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

/** The separator between the parts of a card's line, as its own item so the gaps on both sides match. */
function Dot() {
  return (
    <span aria-hidden className="text-[#b9c0bd]">
      ·
    </span>
  );
}
