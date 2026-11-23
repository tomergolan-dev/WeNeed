"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { ItemInput } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CATEGORIES, DEFAULT_CATEGORY, isCategory } from "@/lib/categories";

/** Form state; quantity stays a string while the user types. */
export type ItemDraft = { name: string; quantity: string; unit: string; category: string };

export const emptyDraft: ItemDraft = {
  name: "",
  quantity: "",
  unit: "",
  category: DEFAULT_CATEGORY,
};

export function toItemInput(draft: ItemDraft): ItemInput | null {
  const name = draft.name.trim();
  if (!name) return null;

  const raw = draft.quantity.trim().replace(",", ".");
  const quantity = raw ? Number(raw) : null;
  if (quantity !== null && !(quantity > 0)) return null;

  return {
    name,
    quantity,
    unit: draft.unit.trim() || null,
    category: isCategory(draft.category) ? draft.category : DEFAULT_CATEGORY,
  };
}

type Props = {
  draft: ItemDraft;
  onChange: (draft: ItemDraft) => void;
  showName?: boolean;
};

export function ItemFields({ draft, onChange, showName = true }: Props) {
  const t = useTranslations("ItemForm");
  const tCategories = useTranslations("Categories");
  const id = useId();
  const set = (patch: Partial<ItemDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="grid grid-cols-2 gap-3">
      {showName && (
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor={`${id}-name`} className="text-[13px] text-muted-foreground">{t("name")}</Label>
          <Input
            id={`${id}-name`}
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={100}
            required
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-quantity`} className="text-[13px] text-muted-foreground">{t("quantity")}</Label>
        <Input
          id={`${id}-quantity`}
          inputMode="decimal"
          value={draft.quantity}
          onChange={(e) => set({ quantity: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-unit`} className="text-[13px] text-muted-foreground">{t("unit")}</Label>
        <Input
          id={`${id}-unit`}
          value={draft.unit}
          onChange={(e) => set({ unit: e.target.value })}
          placeholder={t("unitPlaceholder")}
          maxLength={30}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor={`${id}-category`} className="text-[13px] text-muted-foreground">{t("category")}</Label>
        <NativeSelect
          id={`${id}-category`}
          className="w-full"
          value={draft.category}
          onChange={(e) => set({ category: e.target.value })}
        >
          {CATEGORIES.map((category) => (
            <NativeSelectOption key={category} value={category}>
              {tCategories(category)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
