"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { createList } from "@/app/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { ListNameForm } from "./list-name-form";

/** "New list": a sheet asking for the list's name; creating it opens the list. */
export function NewListButton() {
  const t = useTranslations("Lists");
  const [open, setOpen] = useState(false);

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
        <ListNameForm submitLabel={t("create")} onSubmit={createList} />
      </BottomSheet>
    </>
  );
}
