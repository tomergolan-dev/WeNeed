"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { respondToInvite } from "@/app/sharing-actions";
import { Button } from "@/components/ui/button";

/** Accept (joins and opens the list) or decline (back home). */
export function InviteAnswer({ inviteId }: { inviteId: string }) {
  const t = useTranslations("Invite");
  const tErrors = useTranslations("Errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function answer(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondToInvite(inviteId, accept);
      if (!result.ok) setError(tErrors(result.error));
      else if (!accept) router.push("/");
    });
  }

  return (
    <div className="mt-5.5 flex flex-col gap-2.5">
      <Button type="button" size="xl" disabled={pending} onClick={() => answer(true)} className="w-full">
        <Check className="size-5" aria-hidden />
        {t("accept")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xl"
        disabled={pending}
        onClick={() => answer(false)}
        className="w-full"
      >
        {t("decline")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
