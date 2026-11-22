"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { LogOut, Trash2 } from "lucide-react";
import { deletePlace, leavePlace, type SharingResult } from "@/app/sharing-actions";
import { Link } from "@/i18n/navigation";
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
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const row =
  "flex min-h-13 w-full items-center gap-3 px-3.5 py-3 text-start font-semibold text-destructive transition-colors active:bg-muted";

/**
 * At the bottom of a shared place's settings: "יציאה מהמקום" for anyone (when
 * someone else is in it), and "מחיקת המקום" for admins, which asks for the
 * place's name first.
 */
export function PlaceDanger({
  name,
  admin,
  alone,
  lastAdmin,
}: {
  name: string;
  admin: boolean;
  alone: boolean;
  lastAdmin: boolean;
}) {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Leaving would strand the place without an admin.
  const mustHandOver = admin && lastAdmin;

  const run = (action: () => Promise<SharingResult>) =>
    startTransition(async () => {
      setError(null);
      try {
        // On success the action redirects home.
        const result = await action();
        if (!result.ok) setError(tErrors(result.error));
      } catch {
        setError(tErrors("generic"));
      }
    });

  if (alone && !admin) return null;

  return (
    <section aria-label={t("danger")} className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-[18px] border bg-card shadow-soft">
        {!alone && (
          <AlertDialog onOpenChange={() => setError(null)}>
            <AlertDialogTrigger className={row}>
              <LogOut className="size-[18px] ltr:-scale-x-100" aria-hidden />
              {t("leave")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("leaveTitle", { name })}</AlertDialogTitle>
                <AlertDialogDescription>
                  {mustHandOver ? t("leaveLastAdmin") : t("leaveDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                {mustHandOver ? (
                  <Link href="/members" className={buttonVariants()}>
                    {t("membersLink")}
                  </Link>
                ) : (
                  <AlertDialogAction
                    disabled={pending}
                    onClick={(e) => {
                      e.preventDefault();
                      run(leavePlace);
                    }}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    {t("leaveConfirm")}
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {admin && (
          <AlertDialog
            onOpenChange={() => {
              setTyped("");
              setError(null);
            }}
          >
            <AlertDialogTrigger className={`${row} ${alone ? "" : "border-t border-[#f0f2f1]"}`}>
              <Trash2 className="size-[18px]" aria-hidden />
              {t("delete")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteTitle", { name })}</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <label className="flex flex-col gap-2 text-sm">
                {t("deleteType")}
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={name}
                  autoComplete="off"
                  className="h-11 rounded-xl bg-card text-base"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pending || typed.trim() !== name.trim()}
                  onClick={(e) => {
                    e.preventDefault();
                    run(() => deletePlace(typed));
                  }}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {t("deleteConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </section>
  );
}
