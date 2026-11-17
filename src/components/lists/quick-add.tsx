"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Adding by hand, under the list's title: a name field and an add button.
 * Once a name is typed, `options` (quantity, date and so on) open below it.
 */
export function QuickAdd({
  placeholder,
  value,
  onChange,
  onSubmit,
  canSubmit = value.trim().length > 0,
  options,
  notice,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit?: boolean;
  options?: React.ReactNode;
  // A short note on the last add, such as "updated the quantity".
  notice?: string | null;
}) {
  const t = useTranslations("QuickAdd");
  const inputRef = useRef<HTMLInputElement>(null);
  const open = options && value.trim().length > 0;

  return (
    <form
      className="px-5 lg:px-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit();
        inputRef.current?.focus();
      }}
    >
      <div className="flex h-12 items-center gap-2 rounded-2xl border bg-card ps-3.5 pe-1.5 shadow-soft transition-colors focus-within:border-primary">
        <Plus className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={t("label")}
          maxLength={200}
          enterKeyHint="done"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-9 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {t("add")}
        </button>
      </div>
      {notice && !open && (
        <p role="status" className="mt-1.5 px-1 text-[13px] text-accent-foreground">
          {notice}
        </p>
      )}
      {open && (
        <div className="-mx-5 mt-2 flex items-center gap-2 overflow-x-auto px-5 pb-0.5 lg:-mx-8 lg:px-8 [scrollbar-width:none]">
          {options}
        </div>
      )}
    </form>
  );
}

/** The look shared by the small controls under the name field. */
export const chipClass =
  "flex h-9 shrink-0 items-center rounded-full border bg-card px-3 text-sm text-foreground outline-none transition-colors focus-within:border-primary focus-visible:border-primary";

export function OptionChip({
  on,
  className,
  ...props
}: React.ComponentProps<"button"> & { on?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      {...props}
      className={cn(chipClass, "font-medium", on && "border-foreground bg-foreground text-background", className)}
    />
  );
}

/** Quantity with − and + buttons; empty means no quantity. */
export function QuantityStepper({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("QuickAdd");
  const number = Number(value.replace(",", ".")) || 0;
  const step = (delta: number) => {
    const next = Math.max(0, Math.round((number + delta) * 100) / 100);
    onChange(next ? String(next) : "");
  };
  return (
    <div className={cn(chipClass, "gap-0.5 px-1")}>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={number <= 0}
        aria-label={t("less")}
        className="flex size-7 items-center justify-center rounded-full text-lg leading-none text-muted-foreground active:bg-muted disabled:opacity-40"
      >
        −
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={t("quantity")}
        aria-label={t("quantity")}
        className="w-12 bg-transparent text-center outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={() => step(1)}
        aria-label={t("more")}
        className="flex size-7 items-center justify-center rounded-full text-lg leading-none text-muted-foreground active:bg-muted"
      >
        +
      </button>
    </div>
  );
}

/**
 * A chip that opens the device's date or time picker. The native input lies
 * invisibly over the chip, so tapping it opens the picker everywhere.
 */
export function PickerChip({
  type,
  value,
  onChange,
  label,
  text,
}: {
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  label: string;
  text: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        chipClass,
        "relative gap-1.5 font-medium",
        value && "border-foreground bg-foreground text-background",
      )}
    >
      {text}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
