"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, CalendarDays, Check, Copy, Globe, Menu, PencilLine } from "lucide-react";
import { getCalendarLinks, logOut, setTaskEmails, type CalendarLinks } from "@/app/actions";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { MyNameEditor, MyPeopleRow, MyPeopleView } from "./profile-editor";

const LOCALES = ["he", "en"] as const;

/**
 * The one button in the top row, the same in every place: it opens the
 * user's own settings (the language, task emails, the calendar link) and signing out. A place's settings
 * are not here; they open from the place picker.
 */
export function AccountMenu({
  user,
  className,
}: {
  /** Null in the demo: no account, and "Sign in" instead of signing out. */
  user: { name: string; email: string | null; taskEmails: boolean } | null;
  className?: string;
}) {
  const t = useTranslations("Account");
  const [editing, setEditing] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // "החברים שלי" takes the whole menu, with a way back, since the list can be long.
  const [peopleOpen, setPeopleOpen] = useState(false);
  return (
    <Drawer
      onOpenChange={(open) => {
        if (open) return;
        setEditing(false);
        setCalendarOpen(false);
        setPeopleOpen(false);
      }}
    >
      <DrawerTrigger
        aria-label={t("open")}
        className={cn(
          "flex size-10 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors active:bg-muted",
          className,
        )}
      >
        <Menu className="size-5" aria-hidden />
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl rounded-t-[28px] bg-[#f6f8f7] pt-2.5">
        <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-[#d5dad8]" />
        {/* Scrolls when an open row makes the menu taller than the screen. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
          {user && peopleOpen ? (
            <MyPeopleView onBack={() => setPeopleOpen(false)} />
          ) : (
            <>
              {user && editing && <MyNameEditor name={user.name} onDone={() => setEditing(false)} />}
              {user && !editing && (
                <div className="mb-4 text-center">
                  <p className="flex items-center justify-center gap-1 font-semibold">
                    {user.name}
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      aria-label={t("editName")}
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                    >
                      <PencilLine className="size-4" aria-hidden />
                    </button>
                  </p>
                  {user.email && (
                    <p dir="ltr" className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                </div>
              )}
              <div className="rounded-[18px] border bg-card">
                <div className="flex min-h-15 items-center gap-3 px-4 py-2.5">
                  <Globe className="size-5 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{t("language")}</span>
                  <LanguagePicker />
                </div>
                {user && <TaskEmailsRow initial={user.taskEmails} />}
                {user && <CalendarRow open={calendarOpen} onToggle={() => setCalendarOpen((o) => !o)} />}
                {user && <MyPeopleRow onOpen={() => setPeopleOpen(true)} />}
              </div>
              {user ? (
                <form action={logOut} className="mt-5 text-center">
                  <button type="submit" className="h-10 px-4 text-[15px] text-muted-foreground active:text-foreground">
                    {t("logOut")}
                  </button>
                </form>
              ) : (
                <div className="mt-5 text-center">
                  <Link
                    href="/login"
                    className="inline-flex h-10 items-center px-4 text-[15px] font-semibold text-accent-foreground"
                  >
                    {t("signIn")}
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** עברית | English, as two segments; the chosen language is remembered for a year. */
function LanguagePicker() {
  const t = useTranslations("Account");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="radiogroup" aria-label={t("language")} className="flex rounded-full bg-muted p-1">
      {LOCALES.map((code) => {
        const on = code === locale;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={on}
            lang={code}
            disabled={pending}
            onClick={() => !on && startTransition(() => router.replace(pathname, { locale: code }))}
            className={cn(
              "h-8 rounded-full px-3.5 text-sm text-muted-foreground transition-colors",
              on && "bg-card font-semibold text-foreground shadow-sm",
            )}
          >
            {t(code)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Tasks in my calendar": opens to buttons that add the user's private feed
 * to Google Calendar or the iPhone calendar, copy the link, or replace it.
 */
function CalendarRow({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useTranslations("Account");
  const tErrors = useTranslations("Errors");
  const [links, setLinks] = useState<Extract<CalendarLinks, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = (fresh = false) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await getCalendarLinks(fresh);
        if (result.ok) setLinks(result);
        else setError(tErrors(result.error));
      } catch {
        setError(tErrors("generic"));
      }
    });

  const button =
    "flex h-10 items-center justify-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-semibold transition-colors active:bg-muted";

  return (
    <div className="border-t px-4 py-2.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          onToggle();
          if (!links) load();
        }}
        className="flex min-h-10 w-full items-center gap-3 text-start"
      >
        <CalendarDays className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex flex-1 flex-col">
          <span>{t("calendar")}</span>
          <span className="text-xs text-muted-foreground">{t("calendarHint")}</span>
        </span>
      </button>
      {open && (
        <div className="mt-2.5 flex flex-col gap-2 pb-1">
          <p className="text-sm leading-5">{t("calendarStep")}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={links?.google}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!links}
              className={cn(button, !links && "pointer-events-none opacity-50")}
            >
              {t("calendarGoogle")}
            </a>
            <a
              href={links?.webcal}
              aria-disabled={!links}
              className={cn(button, !links && "pointer-events-none opacity-50")}
            >
              {t("calendarApple")}
            </a>
          </div>
          <button
            type="button"
            disabled={!links}
            onClick={() =>
              links &&
              navigator.clipboard.writeText(links.https).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
            }
            className={cn(button, "disabled:opacity-50")}
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? t("calendarCopied") : t("calendarCopy")}
          </button>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("calendarPrivate")}{" "}
            <button
              type="button"
              disabled={pending}
              onClick={() => load(true)}
              className="font-semibold text-accent-foreground underline-offset-2 active:underline"
            >
              {t("calendarNew")}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

/** Emails about my tasks (assigned to me, reminders), on or off. */
function TaskEmailsRow({ initial }: { initial: boolean }) {
  const t = useTranslations("Account");
  const [on, setOn] = useState(initial);
  return (
    <label className="flex min-h-15 cursor-pointer items-center gap-3 border-t px-4 py-2.5">
      <Bell className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex flex-1 flex-col">
        <span>{t("taskEmails")}</span>
        <span className="text-xs text-muted-foreground">{t("taskEmailsHint")}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          setTaskEmails(next).then((result) => !result.ok && setOn(!next));
        }}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full bg-[#d5dad8] transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
          on && "bg-primary",
          "after:absolute after:start-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform",
          on && "after:translate-x-5 rtl:after:-translate-x-5",
        )}
      />
    </label>
  );
}
