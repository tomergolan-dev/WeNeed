"use client";

import { useState } from "react";
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

// Deleting several items at once, the same in every kind of list: "מחיקה"
// switches the list to picking, each row gets a circle that turns red when
// picked, and "מחיקה (N)" deletes them after a confirmation.

/** Which items are picked; null when the list is not in picking mode. */
export function useSelection(items: Item[]) {
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const selectable = items.filter((item) => !isDraft(item));
  return {
    selecting: selected !== null,
    count: selected?.size ?? 0,
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

/** "מחיקה": switches the list to picking items. */
export function StartSelectButton({ selection, onStart }: { selection: Selection; onStart?: () => void }) {
  const t = useTranslations("BulkDelete");
  return (
    <ToolButton
      onClick={() => {
        onStart?.();
        selection.start();
      }}
    >
      <Trash2 className="size-3.5" aria-hidden />
      {t("select")}
    </ToolButton>
  );
}

/** Instead of the list's tools while picking: "בחר הכל", "ביטול" and "מחיקה (N)". */
export function SelectToolbar({ selection, onDelete }: { selection: Selection; onDelete: (ids: string[]) => void }) {
  const t = useTranslations("BulkDelete");
  return (
    <div className="flex items-center gap-1.5">
      <span className="min-w-0 flex-1 truncate ps-1 text-[13px] text-muted-foreground">{t("hint")}</span>
      <ToolButton onClick={selection.toggleAll}>{t("selectAll")}</ToolButton>
      <ToolButton onClick={selection.stop}>{t("cancel")}</ToolButton>
      <AlertDialog>
        <AlertDialogTrigger
          disabled={selection.count === 0}
          className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-destructive bg-destructive px-2.5 text-xs font-medium text-white transition-colors disabled:border-border disabled:bg-card disabled:text-muted-foreground disabled:opacity-60"
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
