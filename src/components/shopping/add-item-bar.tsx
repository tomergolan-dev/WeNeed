"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { ItemInput } from "@/app/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { emptyDraft, ItemFields, toItemInput, type ItemDraft } from "./item-fields";

/**
 * The bar at the bottom of a list: type a name and press Enter or +.
 * With nothing typed, + opens a sheet with all the item's details.
 * Stage G turns the field into the list's AI chat.
 */
export function AddItemBar({ onAdd }: { onAdd: (input: ItemInput) => void }) {
  const t = useTranslations("ItemForm");
  const [name, setName] = useState("");
  const [details, setDetails] = useState<ItemDraft | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = toItemInput({ ...emptyDraft, name });
    if (!input) {
      setDetails(emptyDraft);
      return;
    }
    onAdd(input);
    setName("");
    inputRef.current?.focus();
  };

  const detailsInput = details && toItemInput(details);

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[#eef0ef] bg-background/95 backdrop-blur">
      <form
        onSubmit={submit}
        className="mx-auto flex max-w-xl items-center gap-2 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("addPlaceholder")}
          aria-label={t("name")}
          maxLength={100}
          enterKeyHint="done"
          className="h-[52px] min-w-0 flex-1 rounded-full border bg-card px-5 text-base shadow-soft outline-none placeholder:text-muted-foreground focus-visible:border-primary"
        />
        <button
          type="submit"
          aria-label={name.trim() ? t("add") : t("addWithDetails")}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
        >
          <Plus className="size-6" aria-hidden />
        </button>
      </form>

      <BottomSheet open={details !== null} onOpenChange={(open) => !open && setDetails(null)} title={t("newTitle")}>
        {details && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!detailsInput) return;
              onAdd(detailsInput);
              setDetails(null);
            }}
          >
            <ItemFields draft={details} onChange={setDetails} />
            <Button type="submit" size="xl" disabled={!detailsInput}>
              {t("add")}
            </Button>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
