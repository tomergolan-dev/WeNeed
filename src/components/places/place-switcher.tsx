"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { cn } from "cn";
import { switchPlace } from "@/app/actions";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import type { PlaceSummary } from "@/lib/auth";
import { PlaceBadge } from "./place-badge";

/** The current place as a card; tapping it opens a bottom sheet with all the user's places. */
export function PlaceSwitcher({ current, places }: { current: PlaceSummary; places: PlaceSummary[] }) {
  const t = useTranslations("Places");
  const tNav = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(current);

  function choose(place: PlaceSummary) {
    setOpen(false);
    if (place.id === shown.id) return;
    startTransition(async () => {
      setShown(place);
      await switchPlace(place.id);
    });
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        aria-label={tNav("switchPlace")}
        className="flex w-full items-center gap-3 rounded-[18px] border bg-card px-3.5 py-3 text-start shadow-soft transition-colors active:bg-muted"
      >
        <PlaceBadge icon={shown.icon} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">{tNav("yourPlace")}</span>
          <span className="truncate text-[17px] font-bold">{shown.name}</span>
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

        <ul className="flex flex-col gap-2.5 overflow-y-auto">
          {places.map((place) => {
            const selected = place.id === shown.id;
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
                    <span className="truncate text-base font-semibold">{place.name}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {t("members", { count: place.memberCount })}
                    </span>
                  </span>
                  {selected && (
                    <span className="flex size-6.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-4" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <Link
          href="/places/new"
          onClick={() => setOpen(false)}
          className="mt-4 flex h-13 items-center justify-center gap-2 rounded-2xl border border-dashed border-[#c3cbc7] text-[15px] font-semibold text-accent-foreground transition-colors active:bg-muted"
        >
          <Plus className="size-4" aria-hidden />
          {t("newPlace")}
        </Link>
      </DrawerContent>
    </Drawer>
  );
}
