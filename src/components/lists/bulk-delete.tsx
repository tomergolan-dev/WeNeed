"use client";

import { createContext, useContext, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Trash2 } from "lucide-react";
import type { Item } from "@/db/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { isDraft } from "./use-list-items";

// Deleting several items at once, the same in every kind of list: "בחירת
// פריטים למחיקה" in the list's menu switches it to picking. The top bar then
// says how many are picked, with "בחר הכל"; each row gets a circle that turns
// red when picked; and the bottom bar, in place of the AI chat, has "ביטול"
// and "מחיקה (N)", which asks for a confirmation.

/** Which items are picked; null when the list is not in picking mode. */
export function useSelection(items: Item[]) {
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const selectable = items.filter((item) => !isDraft(item));
  return {
    selecting: selected !== null,
    count: selected?.size ?? 0,
    /** How many items can be picked (all but those still being saved). */
    total: selectable.length,
    all: selectable.length > 0 && selected?.size === selectable.length,
    ids: () => [...(selected ?? [])],
    has: (id: string) => selected?.has(id) ?? false,
    start: () => setSelected(new Set()),
    stop: () => setSelected(null),
    toggle: (id: string) =>
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    /** Picks every item, or none when all are picked. */
    toggleAll: () =>
      setSelected((current) =>
        current?.size === selectable.length ? new Set() : new Set(selectable.map((item) => item.id)),
      ),
  };
}
export type Selection = ReturnType<typeof useSelection>;

/**
 * A small labeled pill for a list's tools. Dimmed when there is nothing to do;
 * filled green while it is on (reordering), and tapping it again turns it off.
 */
export function ToolButton({ pressed, ...props }: React.ComponentProps<"button"> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      {...props}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1 rounded-full border bg-card px-2.5 text-xs font-medium transition-colors active:bg-muted disabled:opacity-40",
        pressed && "border-primary bg-primary text-primary-foreground active:bg-primary",
      )}
    />
  );
}

const SelectionContext = createContext<{ selection: Selection; onDelete: (ids: string[]) => void } | null>(null);

/**
 * Wraps a list screen, so the list's menu can start picking, and its top and
 * bottom bars turn into the picking bars while it is on.
 */
export const SelectionProvider = SelectionContext.Provider;

export function useListSelection() {
  return useContext(SelectionContext);
}

/** The top bar while picking, in place of the title and quick add: "2 נבחרו" and "בחר הכל". */
export function SelectTopBar({ selection }: { selection: Selection }) {
  const t = useTranslations("BulkDelete");
  return (
    <div className="flex min-h-[60px] items-center gap-3 px-5 pt-4 pb-1 lg:px-8 lg:pt-6">
      <h1 aria-live="polite" className="min-w-0 flex-1 truncate text-xl font-extrabold">
        {t("chosen", { count: selection.count })}
      </h1>
      <ToolButton onClick={selection.toggleAll}>{selection.all ? t("clearAll") : t("selectAll")}</ToolButton>
    </div>
  );
}

/** The bottom bar while picking, in place of the AI chat: "ביטול" and "מחיקה (N)" with a confirmation. */
export function SelectActionBar({ selection, onDelete }: { selection: Selection; onDelete: (ids: string[]) => void }) {
  const t = useTranslations("BulkDelete");
  return (
    <div data-chat className="pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:ps-72">
      <div className="pointer-events-auto mx-auto max-w-xl bg-gradient-to-t from-background from-60% to-transparent px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-3xl lg:px-7 xl:max-w-4xl">
        <div className="flex gap-2 rounded-[22px] border bg-card p-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)]">
          <button
            type="button"
            onClick={selection.stop}
            className="h-11 flex-1 rounded-full border text-[15px] font-semibold transition-colors active:bg-muted"
          >
            {t("cancel")}
          </button>
          <AlertDialog>
            <AlertDialogTrigger
              disabled={selection.count === 0}
              className="flex h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-destructive text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
            >
              <Trash2 className="size-4" aria-hidden />
              {t("delete", { count: selection.count })}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("title", { count: selection.count })}</AlertDialogTitle>
                <AlertDialogDescription>{t("description")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete(selection.ids());
                    selection.stop();
                  }}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {t("confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

/** A row's circle while picking: red with a check when picked. */
export function SelectCircle({ item, selection, className }: { item: Item; selection: Selection; className?: string }) {
  const on = selection.has(item.id);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={item.name}
      disabled={isDraft(item)}
      onClick={() => selection.toggle(item.id)}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c9cfcc] bg-card text-white transition-colors",
        on && "border-destructive bg-destructive",
        className,
      )}
    >
      {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
    </button>
  );
}
