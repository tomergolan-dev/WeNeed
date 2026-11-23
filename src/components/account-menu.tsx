"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, CalendarDays, Camera, Check, Copy, Globe, PencilLine } from "lucide-react";
import { getCalendarLinks, logOut, setTaskEmails, type CalendarLinks } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { AvatarPicker } from "@/components/avatar-picker";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { MyNameEditor, MyPeopleRow, MyPeopleView } from "./profile-editor";

const LOCALES = ["he", "en"] as const;

export type AccountUser = { name: string; email: string | null; taskEmails: boolean; avatar: string | null };

/**
 * The user's own settings (their name, the language, task emails, the
 * calendar link, "My people") and signing out, in a sheet from the bottom.
 * On a wide screen it opens from the user's badge atop the sidebar; on a
 * phone the same settings open inside the side menu (see MobileNav). A
 * place's settings are not here; they open from the home screen.
 */
export function AccountMenu({
  user,
  className,
}: {
  /** Null in the demo: no account, and "Sign in" instead of signing out. */
  user: AccountUser | null;
  className?: string;
}) {
  const t = useTranslations("Account");
  return (
    <Drawer>
      <DrawerTrigger
        aria-label={t("open")}
        className={cn("flex shrink-0 rounded-full transition-opacity active:opacity-80", className)}
      >
        <Avatar name={user?.name ?? null} avatar={user?.avatar} />
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl rounded-t-[28px] bg-[#f6f8f7] pt-2.5">
        <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-[#d5dad8]" />
        {/* Scrolls when an open row makes the menu taller than the screen. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
          <AccountPanel user={user} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * The settings themselves. Their open rows reset each time, since the panel
 * mounts when shown. `flat` (in the side menu) lays the rows edge to edge,
 * like the menu's own rows, instead of in a card.
 */
export function AccountPanel({
  user,
  flat = false,
  onPeople,
}: {
  user: AccountUser | null;
  flat?: boolean;
  /** Told when "החברים שלי" opens or closes, so a surrounding header can step aside for its own. */
  onPeople?: (open: boolean) => void;
}) {
  const t = useTranslations("Account");
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // "החברים שלי" takes the whole panel, with a way back, since the list can be long.
  const [peopleOpen, setPeopleOpen] = useState(false);

  const showPeople = (open: boolean) => {
    setPeopleOpen(open);
    onPeople?.(open);
  };

  if (user && peopleOpen) return <MyPeopleView onBack={() => showPeople(false)} flat={flat} />;
  return (
    <>
      {user && editing && <MyNameEditor name={user.name} onDone={() => setEditing(false)} />}
      {user && !editing && (
        <div className="mb-5 text-center">
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            aria-label={t("avatarChange")}
            aria-expanded={picking}
            className="relative mx-auto mb-2 flex rounded-full active:opacity-80"
          >
            <Avatar name={user.name} avatar={user.avatar} className="size-16 text-2xl" />
            <span className="absolute -end-0.5 bottom-0 flex size-6.5 items-center justify-center rounded-full border-2 border-card bg-muted text-muted-foreground">
              <Camera className="size-3.5" aria-hidden />
            </span>
          </button>
          <p className="flex items-center justify-center gap-0.5 text-[15px] font-semibold">
            {user.name}
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t("editName")}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <PencilLine className="size-3.5" aria-hidden />
            </button>
          </p>
          {user.email && (
            <p dir="ltr" className="text-[13px] text-muted-foreground">
              {user.email}
            </p>
          )}
          {picking && <AvatarPicker name={user.name} avatar={user.avatar} onDone={() => setPicking(false)} />}
        </div>
      )}
      <div className={flat ? "-mx-4 border-y border-border/60" : "overflow-hidden rounded-2xl border border-border/60 bg-card"}>
        <div className="flex min-h-12 items-center gap-3 px-4 py-2">
          <Globe className="size-[18px] text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm">{t("language")}</span>
          <LanguagePicker />
        </div>
        {user && <TaskEmailsRow initial={user.taskEmails} />}
        {user && <CalendarRow open={calendarOpen} onToggle={() => setCalendarOpen((o) => !o)} />}
        {user && <MyPeopleRow onOpen={() => showPeople(true)} />}
      </div>
      {user ? (
        <form action={logOut} className="mt-4 text-center">
          <button type="submit" className="h-10 px-4 text-sm text-muted-foreground active:text-foreground">
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
    <div role="radiogroup" aria-label={t("language")} className="flex rounded-full bg-muted p-0.5">
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
              "h-7 rounded-full px-3 text-[13px] text-muted-foreground transition-colors",
              on && "bg-card font-medium text-foreground shadow-sm",
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
    "flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 text-[13px] font-medium transition-colors active:bg-muted";

  return (
    <div className="border-t border-border/60 px-4 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          onToggle();
          if (!links) load();
        }}
        className="flex min-h-9 w-full items-center gap-3 text-start"
      >
        <CalendarDays className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm">{t("calendar")}</span>
          <span className="text-xs leading-snug text-muted-foreground">{t("calendarHint")}</span>
        </span>
      </button>
      {open && (
        <div className="mt-2.5 flex flex-col gap-2 pb-1">
          <p className="text-[13px] leading-5">{t("calendarStep")}</p>
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
    <label className="flex min-h-12 cursor-pointer items-center gap-3 border-t border-border/60 px-4 py-2">
      <Bell className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm">{t("taskEmails")}</span>
        <span className="text-xs leading-snug text-muted-foreground">{t("taskEmailsHint")}</span>
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
          "relative h-6 w-10 shrink-0 rounded-full bg-[#d5dad8] transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
          on && "bg-primary",
          "after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform",
          on && "after:translate-x-4 rtl:after:-translate-x-4",
        )}
      />
    </label>
  );
}
