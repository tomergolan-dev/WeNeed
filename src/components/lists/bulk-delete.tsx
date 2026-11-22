"use client";

import { createContext, useContext, useRef, useState } from "react";
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

// Deleting several items at once, the same in every kind of list: a long
// press on an item (or "בחירת פריטים" in the list's menu) switches it to
// picking. Each row then gets a circle that turns red when picked, and a row
// under the progress (or "לטיפול") has "בחר הכל", "ביטול" and "מחיקה (N)",
// which asks for a confirmation. The rest of the screen stays as it is.

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
    /** Starts picking with this item already picked (a long press on it). */
    startWith: (id: string) => setSelected(new Set([id])),
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

const SelectionContext = createContext<{ selection: Selection } | null>(null);

/** Wraps a list screen, so "בחירת פריטים" in the list's menu can start picking. */
export const SelectionProvider = SelectionContext.Provider;

export function useListSelection() {
  return useContext(SelectionContext);
}

const LONG_PRESS_MS = 450;
const MOVE_SLOP = 10;

/**
 * Props for a row: a long press on it starts picking with it picked. A press
 * that moves (a scroll) doesn't count, and the tap that ends a long press
 * doesn't also open or check the item. Off while picking (a tap picks then).
 */
export function useLongPressPick(selection: Selection, id: string, disabled = false) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const off = disabled || selection.selecting;
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      if (off || (e.pointerType === "mouse" && e.button !== 0)) return;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(15);
        selection.startWith(id);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!timer.current || !start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      if (!off) e.preventDefault();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}

/** Classes for a row with a long press: no text selection or iOS callout. */
export const longPressRow = "select-none [-webkit-touch-callout:none]";

/**
 * The picking row, under the progress (or "לטיפול") while picking: "בחר הכל",
 * "ביטול" and "מחיקה (N)", which asks for a confirmation. The rest of the
 * screen stays as it is.
 */
export function SelectBar({ selection, onDelete }: { selection: Selection; onDelete: (ids: string[]) => void }) {
  const t = useTranslations("BulkDelete");
  if (!selection.selecting) return null;
  return (
    <div role="group" aria-label={t("chosen", { count: selection.count })} className="flex items-center gap-1.5">
      <ToolButton onClick={selection.toggleAll}>{selection.all ? t("clearAll") : t("selectAll")}</ToolButton>
      <ToolButton onClick={selection.stop}>{t("cancel")}</ToolButton>
      <AlertDialog>
        <AlertDialogTrigger
          disabled={selection.count === 0}
          className="ms-auto flex h-8 shrink-0 items-center gap-1 rounded-full bg-destructive px-3 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
        >
          <Trash2 className="size-3.5" aria-hidden />
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
