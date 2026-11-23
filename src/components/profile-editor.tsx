"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { listMyPeople, setContactName, setMyName, type MyPeople } from "@/app/actions";
import { cn } from "@/lib/utils";

type Person = Extract<MyPeople, { ok: true }>["people"][number];

const field =
  "h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15";

/**
 * In the account menu, "עריכת פרטים": the user's own name, which everyone
 * sees, and what the user calls the people they share things with ("אמא"
 * for נורית), which only they see, everywhere in the app.
 */
export function ProfileEditor({ name, onDone }: { name: string; onDone: () => void }) {
  const t = useTranslations("Account");
  const tErrors = useTranslations("Errors");
  const [myName, setName] = useState(name);
  const [saved, setSaved] = useState(name);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listMyPeople().then((result) => (result.ok ? setPeople(result.people) : setError(tErrors(result.error))));
  }, [tErrors]);

  const changed = myName.trim() !== "" && myName.trim() !== saved;
  const saveName = () =>
    startTransition(async () => {
      setError(null);
      const result = await setMyName(myName);
      if (result.ok) setSaved(myName.trim());
      else setError(tErrors(result.error));
    });

  return (
    <div className="mb-4 flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) saveName();
        }}
        className="flex flex-col gap-1.5"
      >
        <label htmlFor="my-name" className="text-sm font-semibold">
          {t("myName")}
        </label>
        <div className="flex gap-2">
          <input
            id="my-name"
            value={myName}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="name"
            className={field}
          />
          <button
            type="submit"
            disabled={!changed || pending}
            className="h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {t("save")}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t("myNameHint")}</p>
      </form>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">{t("people")}</p>
        <p className="text-xs leading-5 text-muted-foreground">{t("peopleHint")}</p>
        {people === null && !error && <div className="h-15 animate-pulse rounded-[18px] bg-muted" />}
        {people?.length === 0 && <p className="text-sm text-muted-foreground">{t("peopleEmpty")}</p>}
        {people && people.length > 0 && (
          <ul className="overflow-hidden rounded-[18px] border bg-card">
            {people.map((person) => (
              <PersonRow key={person.id} person={person} onError={(code) => setError(tErrors(code))} />
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="button"
        onClick={onDone}
        className="h-11 rounded-xl border bg-card text-sm font-semibold transition-colors active:bg-muted"
      >
        {t("done")}
      </button>
    </div>
  );
}

/** One person: the name they chose, and a field for what the user calls them, saved on leaving it. */
function PersonRow({
  person,
  onError,
}: {
  person: Person;
  onError: (code: "generic" | "invalid" | "unauthorized") => void;
}) {
  const t = useTranslations("Account");
  const [value, setValue] = useState(person.nickname ?? "");
  const [stored, setStored] = useState(person.nickname ?? "");
  const [justSaved, setJustSaved] = useState(false);

  const save = () => {
    const next = value.trim();
    if (next === stored) return;
    setStored(next);
    setContactName(person.id, next).then((result) => {
      if (!result.ok) {
        setStored(stored);
        onError(result.error === "invalid" || result.error === "unauthorized" ? result.error : "generic");
        return;
      }
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    });
  };

  return (
    <li className="flex items-center gap-3 border-t px-3.5 py-2.5 first:border-t-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px]">{person.name}</span>
      </span>
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
