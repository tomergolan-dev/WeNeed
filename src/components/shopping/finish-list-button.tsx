"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { useBackend } from "@/components/lists/backend";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** "Finish shopping": locks the round into the list's history and starts a new one. */
export function FinishListButton({ listId, remaining }: { listId: string; remaining: number }) {
  const t = useTranslations("Shopping");
  const tErrors = useTranslations("Errors");
  const { finishRound } = useBackend();
  const [open, setOpen] = useState(false);
  const [carryOver, setCarryOver] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const finish = () =>
    startTransition(async () => {
      const result = await finishRound(listId, remaining > 0 && carryOver);
      if (result.ok) setOpen(false);
      else setError(tErrors(result.error));
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-border/60 bg-card ps-2.5 pe-3 text-[13px] font-medium transition-colors active:bg-muted">
        <ShoppingCart className="size-4 text-primary" aria-hidden />
        {t("finish")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("finishTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("finishDescription", { remaining })}</AlertDialogDescription>
        </AlertDialogHeader>
        {remaining > 0 && (
          <Label className="items-start gap-2 font-normal leading-relaxed">
            <Checkbox
              checked={carryOver}
              onCheckedChange={(checked) => setCarryOver(checked === true)}
              className="mt-1"
            />
            {t("carryOver", { count: remaining })}
          </Label>
        )}
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
