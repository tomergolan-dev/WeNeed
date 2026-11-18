"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { useBackend } from "@/components/lists/backend";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { focusOnOpen } from "@/lib/focus";
import { guessListType, type ListType } from "@/lib/list-kinds";
import { ListTypePicker } from "./list-type-picker";

/** "New list": a name and a kind. The kind follows the name until the user picks one. */
export function NewListButton() {
  const t = useTranslations("Lists");
  const [open, setOpen] = useState(false);
  // Creating a list moves to it, and Next keeps this screen in the background
  // (its effects are cleaned up then): start closed when coming back.
  useEffect(() => () => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1 text-sm font-semibold text-accent-foreground"
      >
        <Plus className="size-4" aria-hidden />
        {t("new")}
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title={t("newTitle")}>
        {open && <NewListForm />}
      </BottomSheet>
    </>
  );
}

function NewListForm() {
  const t = useTranslations("Lists");
  const { createList } = useBackend();
  const tErrors = useTranslations("Errors");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<ListType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const type = picked ?? guessListType(name) ?? "shopping";

  return (
    <form
      className="flex flex-col gap-3 overflow-y-auto"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await createList(name, type);
          if (!result.ok) setError(tErrors(result.error));
        });
      }}
    >
      <label htmlFor="list-name" className="text-sm font-semibold">
        {t("nameLabel")}
      </label>
      <Input
        id="list-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("namePlaceholder")}
        maxLength={40}
        autoFocus={focusOnOpen()}
        className="h-12 rounded-2xl bg-card text-base"
      />
      <p className="mt-1 text-sm font-semibold">{t("typeLabel")}</p>
      <ListTypePicker value={type} onChange={setPicked} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="xl" className="mt-1" disabled={pending || !name.trim()}>
        {t("create")}
      </Button>
    </form>
  );
}
