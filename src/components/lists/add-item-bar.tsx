"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";

/**
 * The bar at the bottom of a list: type a name and press Enter or +.
 * With nothing typed, + opens a sheet with all the details, when the list
 * has any. Stage D turns the field into the list's AI chat.
 */
export function AddItemBar({
  placeholder,
  onAdd,
  details,
}: {
  placeholder: string;
  onAdd: (name: string) => void;
  details?: { title: string; render: (close: () => void) => React.ReactNode };
}) {
  const t = useTranslations("ItemForm");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      if (details) setOpen(true);
      else inputRef.current?.focus();
      return;
    }
    onAdd(trimmed);
    setName("");
    inputRef.current?.focus();
  };

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
          placeholder={placeholder}
          aria-label={t("name")}
          maxLength={200}
          enterKeyHint="done"
          className="h-[52px] min-w-0 flex-1 rounded-full border bg-card px-5 text-base shadow-soft outline-none placeholder:text-muted-foreground focus-visible:border-primary"
        />
        <button
          type="submit"
          aria-label={name.trim() || !details ? t("add") : t("addWithDetails")}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
        >
          <Plus className="size-6" aria-hidden />
        </button>
      </form>
      {details && (
        <BottomSheet open={open} onOpenChange={setOpen} title={details.title}>
          {open && details.render(() => setOpen(false))}
        </BottomSheet>
      )}
    </div>
  );
}
