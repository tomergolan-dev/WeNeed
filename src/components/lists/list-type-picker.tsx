"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { LIST_KINDS, LIST_TYPES, type ListType } from "@/lib/list-kinds";
import { cn } from "@/lib/utils";

/** The three kinds of list as cards, each with what it is for. */
export function ListTypePicker({ value, onChange }: { value: ListType; onChange: (type: ListType) => void }) {
  const t = useTranslations("ListKinds");
  return (
    <div role="radiogroup" aria-label={t("label")} className="flex flex-col gap-2">
      {LIST_TYPES.map((type) => {
        const { icon: Icon, tone } = LIST_KINDS[type];
        const selected = type === value;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(type)}
            className={cn(
              "flex items-center gap-3 rounded-[18px] border bg-card px-3.5 py-3 text-start transition-colors active:bg-muted",
              selected && "border-2 border-primary px-[13px] py-[11px]",
            )}
          >
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tone)}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{t(`${type}.name`)}</span>
              <span className="text-[13px] leading-snug text-muted-foreground">{t(`${type}.description`)}</span>
            </span>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-check",
                selected && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {selected && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
