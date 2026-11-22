"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpDown, Check, CheckCheck, ListChecks, RotateCcw, Trash2 } from "lucide-react";
import { useBackend } from "@/components/lists/backend";
import type { Item } from "@/db/schema";
import { BottomSheet } from "@/components/bottom-sheet";
import { ClipChip, DetailsButton } from "@/components/lists/item-details";
import { useAddedBy } from "@/components/lists/added-by";
import { AssistantBar } from "@/components/lists/assistant-bar";
import { ListProgress } from "@/components/lists/list-progress";
import { ListScreen } from "@/components/lists/list-screen";
import { ListTop } from "@/components/lists/list-top";
import { QuickAdd } from "@/components/lists/quick-add";
import { draftItem, isDraft, useListItems } from "@/components/lists/use-list-items";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SortableItems } from "./sortable-items";

/** A permanent list: items are checked, and all unchecked again for next time. */
export function Checklist({
  listId,
  header,
  items,
  people,
}: {
  listId: string;
  header: React.ReactNode;
  items: Item[];
  people: { id: string; name: string }[];
}) {
  const t = useTranslations("Checklist");
  const { addItem, deleteItem, deleteItems, reorderItems, setAllDone, setItemDone, updateItem } = useBackend();
  const tItem = useTranslations("ItemForm");
  const { items: optimistic, run, error } = useListItems(items);
  const [editing, setEditing] = useState<Item | null>(null);
  const addedBy = useAddedBy(editing, people);
  const [reordering, setReordering] = useState(false);
  // "Delete" mode: rows are picked instead of checked, then deleted together.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const selecting = selected !== null;
  const [name, setName] = useState("");

  // Unchecked first, so what's left is at the top; each group keeps the list's order.
  const sorted = [...optimistic.filter((i) => !i.done), ...optimistic.filter((i) => i.done)];
  const done = optimistic.filter((i) => i.done).length;
  const total = optimistic.length;

  const all = (value: boolean) => run({ type: "all", done: value }, () => setAllDone(listId, value));
  const selectable = optimistic.filter((item) => !isDraft(item));
  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const deleteSelected = () => {
    const ids = [...(selected ?? [])];
    if (ids.length > 0) run({ type: "deleteMany", ids }, () => deleteItems(listId, ids));
    setSelected(null);
  };

  return (
    <ListScreen>
      <ListTop header={header}>
        <QuickAdd
          placeholder={t("quickAddPlaceholder")}
          value={name}
          onChange={setName}
          onSubmit={() => {
            const trimmed = name.trim();
            run({ type: "add", item: draftItem({ name: trimmed }) }, () =>
              addItem(listId, { name: trimmed, quantity: null, unit: null }),
            );
            setName("");
          }}
        />
      </ListTop>
      <div data-list-body className="flex flex-col gap-3.5 px-5 pt-3.5 pb-40 lg:px-8">
        {total > 0 && (
          <div className="flex flex-col gap-2.5">
            {/* The progress on its own full-width row, like a shopping list; the tools under it. */}
            <div className="flex min-h-6 items-center ps-1">
              <ListProgress done={done} total={total} label={t("progress", { done, total })} bar="bg-[#c9962a]" />
            </div>
            {selecting ? (
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate ps-1 text-[13px] text-muted-foreground">{t("selectHint")}</span>
                <ToolButton
                  onClick={() =>
                    setSelected(
                      selected.size === selectable.length ? new Set() : new Set(selectable.map((item) => item.id)),
                    )
                  }
                >
                  {t("selectAll")}
                </ToolButton>
                <ToolButton onClick={() => setSelected(null)}>{t("cancelSelect")}</ToolButton>
                <DeleteSelectedButton count={selected.size} onConfirm={deleteSelected} />
              </div>
            ) : (
              <div role="group" aria-label={t("tools")} className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
                <ToolButton onClick={() => all(true)} disabled={done === total}>
                  <CheckCheck className="size-4" aria-hidden />
                  {t("checkAll")}
                </ToolButton>
                <ToolButton onClick={() => all(false)} disabled={done === 0}>
                  <RotateCcw className="size-3.5" aria-hidden />
                  {t("uncheckAll")}
                </ToolButton>
                {total > 1 && (
                  <ToolButton pressed={reordering} onClick={() => setReordering((r) => !r)}>
                    <ArrowUpDown className="size-3.5" aria-hidden />
                    {t("reorder")}
                  </ToolButton>
                )}
                <ToolButton
                  onClick={() => {
                    setReordering(false);
                    setSelected(new Set());
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t("select")}
                </ToolButton>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <span className="flex size-14 items-center justify-center rounded-full bg-[#faf1de] text-[#8f6814]">
              <ListChecks className="size-6" aria-hidden />
            </span>
            {t("empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {reordering && <p className="px-1 text-[13px] text-muted-foreground">{t("reorderHint")}</p>}
            {reordering ? (
              <SortableItems
                items={optimistic.filter((item) => !isDraft(item))}
                onReorder={(ids) => run({ type: "order", ids }, () => reorderItems(listId, ids))}
              />
            ) : (
              <ul className="rounded-[18px] border bg-card shadow-soft">
                {sorted.map((item) => (
                  <li
                    key={item.id}
                    className="flex min-h-[50px] items-center gap-3 border-b border-[#f0f2f1] px-3.5 last:border-b-0"
                  >
                    {selecting ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={selected.has(item.id)}
                        aria-label={item.name}
                        disabled={isDraft(item)}
                        onClick={() => toggleSelected(item.id)}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c9cfcc] bg-card text-white transition-colors",
                          selected.has(item.id) && "border-destructive bg-destructive",
                        )}
                      >
                        {selected.has(item.id) && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={item.done}
                        aria-label={item.name}
                        disabled={isDraft(item)}
                        onClick={() =>
                          run({ type: "patch", id: item.id, patch: { done: !item.done } }, () =>
                            setItemDone(item.id, !item.done),
                          )
                        }
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c9cfcc] bg-card text-white transition-colors",
                          item.done && "border-[#c9962a] bg-[#c9962a]",
                        )}
                      >
                        {item.done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                      </button>
                    )}
                    <div
                      onClick={() => !isDraft(item) && (selecting ? toggleSelected(item.id) : setEditing(item))}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch"
                    >
                      <button
                        type="button"
                        disabled={isDraft(item)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selecting) toggleSelected(item.id);
                          else setEditing(item);
                        }}
                        className={cn(
                          "min-w-0 truncate py-3 text-start text-base font-medium",
                          item.done && "text-muted-foreground",
                          isDraft(item) && "opacity-60",
                        )}
                      >
                        {item.name}
                      </button>
                      {!isDraft(item) && !selecting && <ClipChip item={item} onEdit={() => setEditing(item)} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <AssistantBar listId={listId} placeholder={t("aiPlaceholder")} />

      <BottomSheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={tItem("editTitle")} subtitle={addedBy}>
        {editing && (
          <div className="flex flex-col gap-4">
            <DetailsButton item={editing} onOpen={() => setEditing(null)} onEdit={() => setEditing(editing)} />
            <RenameItemForm
            item={editing}
            onSave={(name) => {
              const { id, quantity, unit } = editing;
              run({ type: "patch", id, patch: { name } }, () =>
                updateItem(id, { name, quantity, unit, category: "other" }),
              );
              setEditing(null);
            }}
            onDelete={() => {
              const id = editing.id;
              run({ type: "delete", id }, () => deleteItem(id));
              setEditing(null);
            }}
          />
          </div>
        )}
      </BottomSheet>
    </ListScreen>
  );
}

/**
 * A small pill beside the progress. Dimmed when there is nothing to do;
 * filled green while it is on (reordering), and tapping it again turns it off.
 */
function ToolButton({ pressed, ...props }: React.ComponentProps<"button"> & { pressed?: boolean }) {
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

function RenameItemForm({
  item,
  onSave,
  onDelete,
}: {
  item: Item;
  onSave: (name: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("ItemForm");
  const [name, setName] = useState(item.name);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={t("name")}
        maxLength={100}
        className="h-12 rounded-2xl bg-card text-base"
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="xl" className="text-destructive" onClick={onDelete}>
          {t("delete")}
        </Button>
        <Button type="submit" size="xl" className="flex-1" disabled={!name.trim()}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

/** "Delete (3)", with a confirmation: deleting can't be undone. */
function DeleteSelectedButton({ count, onConfirm }: { count: number; onConfirm: () => void }) {
  const t = useTranslations("Checklist");
  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={count === 0}
        className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-destructive bg-destructive px-2.5 text-xs font-medium text-white transition-colors disabled:border-border disabled:bg-card disabled:text-muted-foreground disabled:opacity-60"
      >
        <Trash2 className="size-3.5" aria-hidden />
        {t("deleteSelected", { count })}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle", { count })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancelSelect")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-white hover:bg-destructive/90">
            {t("deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
