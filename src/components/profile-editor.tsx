"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, ChevronLeft, Users } from "lucide-react";
import { listMyPeople, setContactName, setMyName, type MyPeople } from "@/app/actions";
import { cn } from "@/lib/utils";

type Person = Extract<MyPeople, { ok: true }>["people"][number];
type ErrorCode = "generic" | "invalid" | "unauthorized";

const field =
  "h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15";

/** At the top of the account menu, in place of the user's name: editing it. Everyone sees it. */
export function MyNameEditor({ name, onDone }: { name: string; onDone: () => void }) {
  const t = useTranslations("Account");
  const tErrors = useTranslations("Errors");
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = value.trim() !== "" && value.trim() !== name;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed) return onDone();
        startTransition(async () => {
          setError(null);
          const result = await setMyName(value);
          if (result.ok) onDone();
          else setError(tErrors(result.error));
        });
      }}
      className="mb-4 flex flex-col gap-1.5"
    >
      <label htmlFor="my-name" className="text-sm font-semibold">
        {t("myName")}
      </label>
      <input
        id="my-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={40}
        autoComplete="name"
        autoFocus
        className={field}
      />
      <p className="text-xs text-muted-foreground">{t("myNameHint")}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDone}
          className="h-11 rounded-xl border bg-card text-sm font-semibold transition-colors active:bg-muted"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending || value.trim() === ""}
          className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {t("save")}
        </button>
      </div>
    </form>
  );
}

/** A row in the account menu, "החברים שלי", which opens the list in place of the menu. */
export function MyPeopleRow({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("Account");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-15 w-full items-center gap-3 border-t px-4 py-2.5 text-start transition-colors active:bg-muted"
    >
      <Users className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex flex-1 flex-col">
        <span>{t("people")}</span>
        <span className="text-xs text-muted-foreground">{t("peopleHint")}</span>
      </span>
      <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:-scale-x-100" aria-hidden />
    </button>
  );
}

/**
 * "החברים שלי", in place of the menu: the people the user shares a place or a
 * list with, each with a field for the user's own name for them ("אמא" for
 * נורית), which only the user sees, everywhere in the app.
 */
export function MyPeopleView({ onBack }: { onBack: () => void }) {
  const t = useTranslations("Account");
  const tErrors = useTranslations("Errors");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyPeople()
      .then((result) => (result.ok ? setPeople(result.people) : setError(tErrors(result.error))))
      .catch(() => setError(tErrors("generic")));
  }, [tErrors]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground active:bg-muted"
        >
          <ArrowRight className="size-5 ltr:-scale-x-100" aria-hidden />
        </button>
        <h2 className="text-lg font-bold">{t("people")}</h2>
      </div>
      <p className="text-sm leading-5 text-muted-foreground">{t("peopleIntro")}</p>
      {people === null && !error && <div className="h-15 animate-pulse rounded-[18px] bg-muted" />}
      {people?.length === 0 && <p className="text-sm text-muted-foreground">{t("peopleEmpty")}</p>}
      {people && people.length > 0 && (
        <ul className="flex flex-col rounded-[18px] border bg-card px-4">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} onError={(code) => setError(tErrors(code))} />
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** One person: the name they chose, and a field for what the user calls them, saved on leaving it. */
function PersonRow({ person, onError }: { person: Person; onError: (code: ErrorCode) => void }) {
  const t = useTranslations("Account");
  const [value, setValue] = useState(person.nickname ?? "");
  const [stored, setStored] = useState(person.nickname ?? "");
  const [justSaved, setJustSaved] = useState(false);

  const save = () => {
    const next = value.trim();
    if (next === stored) return;
    const before = stored;
    setStored(next);
    setContactName(person.id, next).then((result) => {
      if (!result.ok) {
        setStored(before);
        onError(result.error === "invalid" || result.error === "unauthorized" ? result.error : "generic");
        return;
      }
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    });
  };

  return (
    <li className="flex items-center gap-3 border-t py-2.5 first:border-t-0">
      <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
      <span className="relative w-36 shrink-0">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          maxLength={40}
          placeholder={t("nicknamePlaceholder")}
          aria-label={t("nicknameFor", { name: person.name })}
          enterKeyHint="done"
          className={cn(field, "h-10 pe-8 text-[15px]")}
        />
        {justSaved && (
          <Check className="absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-primary" aria-label={t("saved")} />
        )}
      </span>
    </li>
  );
}
