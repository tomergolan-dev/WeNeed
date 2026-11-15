"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { renameHousehold } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HouseholdNameForm({ name }: { name: string }) {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const [value, setValue] = useState(name);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = value.trim();

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await renameHousehold(trimmed);
          setMessage(
            result.ok
              ? { text: t("saved"), error: false }
              : { text: tErrors(result.error), error: true },
          );
        });
      }}
    >
      <Label htmlFor="household-name">{t("householdName")}</Label>
      <div className="flex gap-2">
        <Input
          id="household-name"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage(null);
          }}
          maxLength={60}
          className="h-10 flex-1 text-base"
        />
        <Button type="submit" size="lg" className="h-10" disabled={pending || !trimmed || trimmed === name}>
          {t("save")}
        </Button>
      </div>
      {message && (
        <p className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message.text}
        </p>
      )}
    </form>
  );
}
