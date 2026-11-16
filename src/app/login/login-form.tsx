"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { requestCode, verifyCode, type SignInError } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/phone";

/** Two steps: the phone number, then the 6-digit code sent to it. */
export function LoginForm() {
  const t = useTranslations("Login");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<SignInError | null>(null);
  const [pending, startTransition] = useTransition();

  function sendCode() {
    setError(null);
    startTransition(async () => {
      const result = await requestCode(phone ?? phoneInput);
      if (result.ok) {
        setPhone(result.phone);
        setCode("");
      } else {
        setError(result.error);
      }
    });
  }

  if (!phone) {
    return (
      <form
        className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-elevated"
        onSubmit={(e) => {
          e.preventDefault();
          sendCode();
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">{t("phoneLabel")}</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder={t("phonePlaceholder")}
            autoFocus
            className="h-12 rounded-2xl px-4 text-end text-lg tracking-wide"
            aria-invalid={error ? true : undefined}
          />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
        <Button type="submit" size="xl" disabled={pending || !phoneInput.trim()}>
          {t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-elevated"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          // On success the action redirects, so only failures come back.
          const result = await verifyCode(phone, code);
          setError(result.error);
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{t("codeLabel")}</Label>
        <p className="text-sm text-muted-foreground">
          {t("codeSentTo", { phone: `\u2066${formatPhone(phone)}\u2069` })}
        </p>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
          className="h-14 rounded-2xl text-center text-2xl font-semibold tracking-[0.5em]"
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      <Button type="submit" size="xl" disabled={pending || code.length !== 6}>
        {t("verify")}
      </Button>
      <div className="flex justify-between text-sm font-semibold text-accent-foreground">
        <button
          type="button"
          className="h-10"
          onClick={() => {
            setPhone(null);
            setError(null);
          }}
        >
          {t("changePhone")}
        </button>
        <button type="button" className="h-10 disabled:opacity-50" disabled={pending} onClick={sendCode}>
          {t("resend")}
        </button>
      </div>
    </form>
  );
}
