"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A name field with a submit button, for renaming a list. */
export function ListNameForm({
  initial = "",
  submitLabel,
  onSubmit,
  onDone,
}: {
  initial?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<ActionResult>;
  onDone?: () => void;
}) {
  const t = useTranslations("Lists");
  const tErrors = useTranslations("Errors");
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await onSubmit(name);
          if (result.ok) onDone?.();
          else setError(tErrors(result.error));
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
        autoFocus
        className="h-11 rounded-xl bg-card text-base"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="xl" disabled={pending || !name.trim()}>
        {submitLabel}
      </Button>
    </form>
  );
}
