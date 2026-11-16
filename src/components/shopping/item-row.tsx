"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import type { ItemInput } from "@/app/actions";
import type { Item } from "@/db/schema";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { formatQuantity } from "@/lib/items";
import { cn } from "@/lib/utils";
import { ItemFields, toItemInput, type ItemDraft } from "./item-fields";

type Props = {
  item: Item;
  who: { initial: string; tone: string } | null;
  onToggle: (id: string, done: boolean) => void;
  onUpdate: (id: string, input: ItemInput) => void;
  onDelete: (id: string) => void;
};

export function ItemRow({ item, who, onToggle, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  // Items added a moment ago only exist on this screen until the server confirms.
  const isDraft = item.id.startsWith("draft-");
  const tItem = useTranslations("ItemForm");
  const quantity = formatQuantity(item, tItem("units"));

  return (
    <li className="flex min-h-[50px] items-center gap-3 border-b border-[#f0f2f1] px-3.5 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.name}
        disabled={isDraft}
        onClick={() => onToggle(item.id, !item.done)}
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 border-[#c9cfcc] bg-card text-primary-foreground transition-colors",
          item.done && "border-primary bg-primary",
        )}
      >
        {item.done && <Check className="size-4" strokeWidth={3} aria-hidden />}
      </button>
      <button
        type="button"
        disabled={isDraft}
        onClick={() => setEditing(true)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 py-3 text-start",
          isDraft && "opacity-60",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-base font-medium",
            item.done && "text-muted-foreground line-through",
          )}
        >
          {item.name}
        </span>
        {quantity && <span className="shrink-0 text-sm text-muted-foreground">{quantity}</span>}
        {who && (
          <span
            aria-hidden
            className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold", who.tone)}
          >
            {who.initial}
          </span>
        )}
      </button>
      {editing && (
        <EditItemSheet
          item={item}
          onClose={() => setEditing(false)}
          onSave={(input) => onUpdate(item.id, input)}
          onDelete={() => onDelete(item.id)}
        />
      )}
    </li>
  );
}

function EditItemSheet({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: Item;
  onClose: () => void;
  onSave: (input: ItemInput) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("ItemForm");
  const [draft, setDraft] = useState<ItemDraft>({
    name: item.name,
    quantity: item.quantity?.toString() ?? "",
    unit: item.unit ?? "",
    category: item.category,
  });
  const input = toItemInput(draft);

  return (
    <BottomSheet open onOpenChange={(open) => !open && onClose()} title={t("editTitle")}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input) return;
          onSave(input);
          onClose();
        }}
      >
        <ItemFields draft={draft} onChange={setDraft} />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="text-destructive"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            {t("delete")}
          </Button>
          <Button type="submit" size="xl" className="flex-1" disabled={!input}>
            {t("save")}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
