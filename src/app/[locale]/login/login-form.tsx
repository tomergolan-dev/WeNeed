"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { requestCode, verifyCode, type SignInError } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginError = SignInError | "googleFailed";

/** Google, or an email address and then the 6-digit code sent to it. */
export function LoginForm({ google, initialError }: { google: boolean; initialError: LoginError | null }) {
  const t = useTranslations("Login");
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<LoginError | null>(initialError);
  const [pending, startTransition] = useTransition();

  function sendCode() {
    setError(null);
    startTransition(async () => {
      const result = await requestCode(email ?? emailInput);
      if (result.ok) {
        setEmail(result.email);
        setCode("");
      } else {
        setError(result.error);
      }
    });
  }

  function verify(value: string) {
    if (!email || pending) return;
    setError(null);
    startTransition(async () => {
      // On success the action redirects, so only failures come back.
      const result = await verifyCode(email, value);
      setError(result.error);
      if (result.error === "wrongCode") setCode("");
    });
  }

  const errorText = error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>;

  if (!email) {
    return (
      <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-card p-5">
        {google && (
          <>
            {/* A plain link: the route handler redirects to Google. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- an API route, not a page */}
            <a href="/api/auth/google" className={buttonVariants({ variant: "outline", size: "xl" })}>
              <GoogleLogo />
              {t("google")}
            </a>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("or")}
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="h-11 rounded-xl px-3.5 text-base"
              aria-invalid={error ? true : undefined}
            />
          </div>
          {errorText}
          <Button type="submit" size="xl" disabled={pending || !emailInput.trim()}>
            {t("sendCode")}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        verify(code);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{t("codeLabel")}</Label>
        <p className="text-sm text-muted-foreground">
          {/* U+2066/U+2069 keep the address left-to-right inside the Hebrew sentence. */}
          {t("codeSentTo", { email: `⁦${email}⁩` })}
          <br />
          {t("checkSpam")}
        </p>
        {/* Six digits is the whole code, so it signs in by itself; no extra tap. */}
        <CodeInput
          id="code"
          value={code}
          onChange={(value) => {
            setCode(value);
            if (value.length < 6) setError(null);
          }}
          onComplete={verify}
          disabled={pending}
          invalid={Boolean(error)}
        />
      </div>
      {errorText}
      <Button type="submit" size="xl" disabled={pending || code.length !== 6}>
        {t("verify")}
      </Button>
      <div className="flex justify-between text-sm font-semibold text-accent-foreground">
        <button
          type="button"
          className="h-10"
          onClick={() => {
            setEmail(null);
            setError(null);
          }}
        >
          {t("changeEmail")}
        </button>
        <button type="button" className="h-10 disabled:opacity-50" disabled={pending} onClick={sendCode}>
          {t("resend")}
        </button>
      </div>
    </form>
  );
}

/** Google's "G" mark, as Google's sign-in branding asks. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
    </svg>
  );
}
