"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { openList } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function OpenListForm({ leftovers }: { leftovers: string[] }) {
  const t = useTranslations("Shopping");
  const tErrors = useTranslations("Errors");
  const [carryOver, setCarryOver] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () =>
    startTransition(async () => {
      const result = await openList(leftovers.length > 0 && carryOver);
      if (!result.ok) setError(tErrors(result.error));
    });

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("noActiveTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("noActiveDescription")}</p>
      </div>
      {leftovers.length > 0 && (
        <Label className="items-start gap-2 font-normal leading-relaxed">
          <Checkbox
            checked={carryOver}
            onCheckedChange={(checked) => setCarryOver(checked === true)}
            className="mt-1"
          />
          {t("carryOver", { count: leftovers.length, names: leftovers.join(", ") })}
        </Label>
      )}
      <Button onClick={open} disabled={pending} size="lg">
        {t("openList")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
