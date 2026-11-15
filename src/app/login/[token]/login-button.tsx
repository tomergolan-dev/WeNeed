"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { logIn } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function LoginButton({ token }: { token: string }) {
  const t = useTranslations("Login");
  const [invalid, setInvalid] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await logIn(token);
            if (!result.ok) setInvalid(true);
          })
        }
      >
        {t("enter")}
      </Button>
      {invalid && <p className="text-sm text-destructive">{t("invalid")}</p>}
    </>
  );
}
