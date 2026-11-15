"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { finishList } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function FinishListButton({ listId, remaining }: { listId: string; remaining: number }) {
  const t = useTranslations("Shopping");
  const tErrors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const finish = () =>
    startTransition(async () => {
      const result = await finishList(listId);
      if (result.ok) setOpen(false);
      else setError(tErrors(result.error));
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" size="lg" className="mt-4" />}>
        {t("finish")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("finishTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("finishDescription", { remaining })}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={finish} disabled={pending}>
            {t("finishConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
