"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import type { ItemInput } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyDraft, ItemFields, toItemInput, type ItemDraft } from "./item-fields";

export function AddItemForm({ onAdd }: { onAdd: (input: ItemInput) => void }) {
  const t = useTranslations("ItemForm");
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [showDetails, setShowDetails] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = toItemInput(draft);
    if (!input) return;
    onAdd(input);
    // Keep the chosen section, so adding several items from one section is quick.
    setDraft({ ...emptyDraft, category: draft.category });
    nameRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          ref={nameRef}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder={t("addPlaceholder")}
          aria-label={t("name")}
          maxLength={100}
          className="h-10 flex-1 text-base"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-10"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          aria-label={t("more")}
        >
          <ChevronDownIcon className={showDetails ? "rotate-180 transition-transform" : "transition-transform"} />
        </Button>
        <Button type="submit" size="lg" className="h-10" disabled={!draft.name.trim()}>
          <PlusIcon />
          {t("add")}
        </Button>
      </div>
      {showDetails && <ItemFields draft={draft} onChange={setDraft} showName={false} />}
    </form>
  );
}
