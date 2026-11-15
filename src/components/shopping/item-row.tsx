"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ItemInput } from "@/app/actions";
import type { Item } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatQuantity } from "@/lib/items";
import { cn } from "@/lib/utils";
import { ItemFields, toItemInput, type ItemDraft } from "./item-fields";

type Props = {
  item: Item;
  onToggle: (id: string, done: boolean) => void;
  onUpdate: (id: string, input: ItemInput) => void;
  onDelete: (id: string) => void;
};

export function ItemRow({ item, onToggle, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  // Items added a moment ago only exist on this screen until the server confirms.
  const isDraft = item.id.startsWith("draft-");
  const quantity = formatQuantity(item);

  return (
    <li className="flex min-h-11 items-center gap-3 border-b last:border-b-0">
      <Checkbox
        checked={item.done}
        disabled={isDraft}
        onCheckedChange={(checked) => onToggle(item.id, checked === true)}
        aria-label={item.name}
        className="size-5"
      />
      <button
        type="button"
        disabled={isDraft}
        onClick={() => setEditing(true)}
        className={cn(
          "flex flex-1 items-baseline gap-2 py-2.5 text-start",
          item.done && "text-muted-foreground line-through",
          isDraft && "opacity-60",
        )}
      >
        <span className="text-base">{item.name}</span>
        {quantity && <span className="text-sm text-muted-foreground">{quantity}</span>}
      </button>
      {editing && (
        <EditItemDialog
          item={item}
          onClose={() => setEditing(false)}
          onSave={(input) => onUpdate(item.id, input)}
          onDelete={() => onDelete(item.id)}
        />
      )}
    </li>
  );
}

function EditItemDialog({
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input) return;
            onSave(input);
            onClose();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <ItemFields draft={draft} onChange={setDraft} />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              {t("delete")}
            </Button>
            <Button type="submit" disabled={!input}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
