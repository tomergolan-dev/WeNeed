"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { cn } from "cn";
import { switchPlace } from "@/app/actions";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import type { PlaceSummary } from "@/lib/auth";
import { PlaceBadge } from "./place-badge";

/**
 * The current place as a card; tapping it opens a bottom sheet: the personal
 * area first, then shared places, then any pending invites.
 */
export function PlaceSwitcher({
  current,
  places,
  sharedWithMe,
  invites,
}: {
  current: PlaceSummary;
  places: PlaceSummary[];
  /** Lists other people shared with the user, counted on "שלי". */
  sharedWithMe: number;
  invites?: React.ReactNode;
}) {
  const t = useTranslations("Places");
  const tNav = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(current);
  const personal = places.find((p) => p.personal);
  const shared = places.filter((p) => !p.personal);

  function choose(place: PlaceSummary) {
    setOpen(false);
    if (place.id === shown.id) return;
    startTransition(async () => {
      setShown(place);
      await switchPlace(place.id);
    });
  }

  const name = (place: PlaceSummary) => (place.personal ? t("personal") : place.name);

  function row(place: PlaceSummary) {
    const selected = place.id === shown.id;
    const meta = place.personal
      ? t("personalMeta", { lists: place.listCount, shared: sharedWithMe })
      : place.allLists || place.role === "owner"
        ? t("placeMeta", { members: place.memberCount, lists: place.listCount })
        : t("placeMetaLimited", { members: place.memberCount, visible: place.visibleCount, lists: place.listCount });
    return (
      <li key={place.id}>
        <button
          type="button"
          onClick={() => choose(place)}
          aria-current={selected ? "true" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-[18px] border bg-card px-3.5 py-3 text-start transition-colors active:bg-muted",
            selected && "border-2 border-primary px-[13px] py-[11px]",
          )}
        >
          <PlaceBadge icon={place.icon} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <span className="truncate text-base font-semibold">{name(place)}</span>
              {!place.personal && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    place.role === "owner" ? "bg-accent text-accent-foreground" : "bg-[#eceff0] text-[#4c5853]",
                  )}
                >
                  {place.role === "owner" ? t("admin") : t("member")}
                </span>
              )}
            </span>
            <span className="text-[13px] text-muted-foreground">{meta}</span>
          </span>
          {selected && (
            <span className="flex size-6.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-4" strokeWidth={3} aria-hidden />
            </span>
          )}
        </button>
      </li>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        aria-label={tNav("switchPlace")}
        className="flex w-full items-center gap-3 rounded-[18px] border bg-card px-3.5 py-3 text-start shadow-soft transition-colors active:bg-muted"
      >
        <PlaceBadge icon={shown.icon} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">{shown.personal ? tNav("personalArea") : tNav("yourPlace")}</span>
          <span className="truncate text-[17px] font-bold">{name(shown)}</span>
        </span>
        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ChevronDown className="size-4" aria-hidden />
        </span>
      </DrawerTrigger>

      <DrawerContent className="mx-auto max-w-xl rounded-t-[28px] bg-[#f6f8f7] px-5 pt-2.5 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <div aria-hidden className="mx-auto mb-3.5 h-1.5 w-10 rounded-full bg-[#d5dad8]" />
        <div className="mb-3.5 flex items-center justify-between">
          <DrawerTitle className="text-xl font-extrabold">{t("title")}</DrawerTitle>
          <DrawerClose
            aria-label={t("close")}
            className="flex size-10 items-center justify-center rounded-full bg-[#eceff0] text-[#4c5853]"
          >
            <X className="size-4" aria-hidden />
          </DrawerClose>
        </div>

        <div className="flex flex-col overflow-y-auto">
          {personal && <ul className="flex flex-col">{row(personal)}</ul>}
          {shared.length > 0 && (
            <>
              <h3 className="px-1 pt-5 pb-2.5 text-[13px] font-semibold text-muted-foreground">{t("sharedPlaces")}</h3>
              <ul className="flex flex-col gap-2.5">{shared.map(row)}</ul>
            </>
          )}

          <Link
            href="/places/new"
            onClick={() => setOpen(false)}
            className="mt-4 flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-[#c3cbc7] text-[15px] font-semibold text-accent-foreground transition-colors active:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
            {t("newPlace")}
          </Link>
          {invites && (
            <div className="mt-4 flex flex-col gap-2.5" onClick={() => setOpen(false)}>
              {invites}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
