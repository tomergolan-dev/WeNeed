"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, Ellipsis, History, Pencil, Shapes, Trash2 } from "lucide-react";
import { deleteList, renameList, setListType } from "@/app/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { ListType } from "@/lib/list-kinds";
import { ListNameForm } from "./list-name-form";
import { ListTypePicker } from "./list-type-picker";

const row =
  "flex h-14 w-full items-center gap-3 rounded-2xl border bg-card px-4 text-start font-semibold transition-colors active:bg-muted";

/** The list's ⋯ menu: history (shopping), rename, kind and delete. */
export function ListMenu({ listId, name, type }: { listId: string; name: string; type: ListType }) {
  const t = useTranslations("Lists");
  const tErrors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "rename" | "type" | "delete">("menu");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label={t("menu")}
        onClick={() => {
          setView("menu");
          setError(null);
          setOpen(true);
        }}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-card transition-colors active:bg-muted"
      >
        <Ellipsis className="size-5" aria-hidden />
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={
          view === "rename"
            ? t("renameTitle")
            : view === "type"
              ? t("typeTitle")
              : view === "delete"
                ? t("deleteTitle")
                : name
        }
      >
        {view === "menu" && (
          <div className="flex flex-col gap-2.5">
            {type === "shopping" && (
              <Link href={`/lists/${listId}/history`} onClick={close} className={row}>
                <History className="size-5 text-muted-foreground" aria-hidden />
                <span className="flex-1">{t("history")}</span>
                <ChevronLeft className="size-4 text-muted-foreground ltr:-scale-x-100" aria-hidden />
              </Link>
            )}
            <button type="button" onClick={() => setView("rename")} className={row}>
              <Pencil className="size-5 text-muted-foreground" aria-hidden />
              {t("rename")}
            </button>
            <button type="button" onClick={() => setView("type")} className={row}>
              <Shapes className="size-5 text-muted-foreground" aria-hidden />
              {t("changeType")}
            </button>
            <button type="button" onClick={() => setView("delete")} className={`${row} text-destructive`}>
              <Trash2 className="size-5" aria-hidden />
              {t("delete")}
            </button>
          </div>
        )}
        {view === "rename" && (
          <ListNameForm
            initial={name}
            submitLabel={t("save")}
            onSubmit={(value) => renameList(listId, value)}
            onDone={close}
          />
        )}
        {view === "type" && (
          <div className="flex flex-col gap-3">
            <ListTypePicker
              value={type}
              onChange={(next) =>
                startTransition(async () => {
                  if (next === type) return close();
                  const result = await setListType(listId, next);
                  if (result.ok) close();
                  else setError(tErrors(result.error));
                })
              }
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        {view === "delete" && (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">{t("deleteDescription", { name })}</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="xl" onClick={() => setView("menu")}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="xl"
                className="flex-1"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteList(listId);
                    if (!result.ok) setError(tErrors(result.error));
                  })
                }
              >
                {t("deleteConfirm")}
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
