"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronLeft, PencilLine, Users } from "lucide-react";
import { listMyPeople, setContactName, setMyName, type MyPeople } from "@/app/actions";
import { cn } from "@/lib/utils";

type Person = Extract<MyPeople, { ok: true }>["people"][number];
type ErrorCode = "generic" | "invalid" | "unauthorized";

// Text in fields stays 16px: smaller makes iPhone zoom in on typing.
const field =
  "h-10 w-full min-w-0 rounded-xl border border-border/70 bg-card px-3 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15";

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
      <label htmlFor="my-name" className="text-[13px] font-medium text-muted-foreground">
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
      <p className="text-[13px] text-muted-foreground">{t("myNameHint")}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDone}
          className="h-10 rounded-xl border border-border/70 bg-card text-sm font-medium transition-colors active:bg-muted"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending || value.trim() === ""}
          className="h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
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
      className="flex min-h-13 w-full items-center gap-3 border-t border-border/60 px-4 py-2 text-start transition-colors active:bg-muted"
    >
      <Users className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px]">{t("people")}</span>
        <span className="text-[13px] leading-snug text-muted-foreground">{t("peopleHint")}</span>
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground active:bg-muted"
        >
          <ArrowRight className="size-[18px] ltr:-scale-x-100" aria-hidden />
        </button>
        <h2 className="text-[17px] font-semibold">{t("people")}</h2>
      </div>
      <p className="text-[13px] leading-5 text-muted-foreground">{t("peopleIntro")}</p>
      {people === null && !error && <div className="h-15 animate-pulse rounded-[18px] bg-muted" />}
      {people?.length === 0 && <p className="text-sm text-muted-foreground">{t("peopleEmpty")}</p>}
      {people && people.length > 0 && (
        <ul className="flex flex-col rounded-2xl border border-border/60 bg-card px-4">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} onError={(code) => setError(tErrors(code))} />
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/**
 * One person, like a contact in a phone: the name the user calls them (or the
 * name they chose), with the other underneath. Tapping it edits the user's
 * name for them in place; leaving the field or "done" saves it.
 */
function PersonRow({ person, onError }: { person: Person; onError: (code: ErrorCode) => void }) {
  const t = useTranslations("Account");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(person.nickname ?? "");
  const [stored, setStored] = useState(person.nickname ?? "");

  const save = () => {
    setEditing(false);
    const next = value.trim();
    setValue(next);
    if (next === stored) return;
    const before = stored;
    setStored(next);
    setContactName(person.id, next).then((result) => {
      if (result.ok) return;
      setStored(before);
      setValue(before);
      onError(result.error === "invalid" || result.error === "unauthorized" ? result.error : "generic");
    });
  };

  return (
    <li className="border-t border-border/60 first:border-t-0">
      {editing ? (
        <div className="flex min-h-14 flex-col justify-center gap-1 py-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setValue(stored);
                setEditing(false);
              }
            }}
            autoFocus
            maxLength={40}
            placeholder={person.name}
            aria-label={t("nicknameFor", { name: person.name })}
            enterKeyHint="done"
            className={cn(field, "h-9 rounded-lg border-transparent bg-muted")}
          />
          <span className="truncate text-[13px] text-muted-foreground">{person.name}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t("nicknameFor", { name: person.name })}
          className="flex min-h-14 w-full items-center gap-3 py-2 text-start"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px]">{stored || person.name}</span>
            {stored && <span className="truncate text-[13px] text-muted-foreground">{person.name}</span>}
          </span>
          <PencilLine className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}
    </li>
  );
}
