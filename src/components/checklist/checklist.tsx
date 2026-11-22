"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpDown, Check, CheckCheck, ListChecks, RotateCcw } from "lucide-react";
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
  const { addItem, deleteItem, reorderItems, setAllDone, setItemDone, updateItem } = useBackend();
  const tItem = useTranslations("ItemForm");
  const { items: optimistic, run, error } = useListItems(items);
  const [editing, setEditing] = useState<Item | null>(null);
  const addedBy = useAddedBy(editing, people);
  const [reordering, setReordering] = useState(false);
  const [name, setName] = useState("");

  // Unchecked first, so what's left is at the top; each group keeps the list's order.
  const sorted = [...optimistic.filter((i) => !i.done), ...optimistic.filter((i) => i.done)];
  const done = optimistic.filter((i) => i.done).length;
  const total = optimistic.length;

  const all = (value: boolean) => run({ type: "all", done: value }, () => setAllDone(listId, value));

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
          <div className="flex items-center gap-3">
            <ListProgress done={done} total={total} label={`${done}/${total}`} bar="bg-[#c9962a]" />
            <div className="flex shrink-0 items-center gap-1.5">
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
            </div>
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
                    <div
                      onClick={() => !isDraft(item) && setEditing(item)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch"
                    >
                      <button
                        type="button"
                        disabled={isDraft(item)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(item);
                        }}
                        className={cn(
                          "min-w-0 truncate py-3 text-start text-base font-medium",
                          item.done && "text-muted-foreground",
                          isDraft(item) && "opacity-60",
                        )}
                      >
                        {item.name}
                      </button>
                      {!isDraft(item) && <ClipChip item={item} onEdit={() => setEditing(item)} />}
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
        "flex h-8 items-center gap-1 rounded-full border bg-card px-2.5 text-xs font-medium transition-colors active:bg-muted disabled:opacity-40",
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
