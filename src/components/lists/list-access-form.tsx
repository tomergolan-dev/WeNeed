"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Mail } from "lucide-react";
import { cn } from "cn";
import { inviteToList, setListAccess } from "@/app/sharing-actions";
import { Initial } from "@/components/people";
import { Button } from "@/components/ui/button";
import type { ListAccess } from "@/lib/list-access";

/**
 * "Who sees this list": the whole place or selected people, plus inviting
 * someone to this list only. In a personal area: who the list is shared with.
 */
export function ListAccessForm({
  listId,
  access,
  userId,
  onDone,
}: {
  listId: string;
  access: ListAccess;
  userId: string;
  onDone: () => void;
}) {
  const t = useTranslations("Access");
  const tErrors = useTranslations("Errors");
  const [visibility, setVisibility] = useState(access.visibility);
  const [selected, setSelected] = useState(() => new Set(access.people.filter((p) => p.added).map((p) => p.id)));
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  // Who sees the list no matter what is checked here.
  const locked = (person: ListAccess["people"][number]) =>
    access.personal
      ? person.id === userId
      : person.role === "owner" || (visibility === "place" && person.allLists);

  const members = access.people.filter((p) => p.role !== null);
  const seeing = members.filter((p) => locked(p) || selected.has(p.id)).length;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    // Everyone in the place checked is the same as "the whole place": switch to it.
    if (!access.personal && visibility === "selected" && members.every((p) => p.role === "owner" || next.has(p.id))) {
      setVisibility("place");
    }
  }

  function invite(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    startTransition(async () => {
      const result = await inviteToList(listId, address);
      if (result.ok) {
        setEmail("");
        setNotice({ text: result.added ? t("added", { email: `\u2068${address}\u2069` }) : t("invited", { email: `\u2068${address}\u2069` }) });
      } else {
        setNotice({ text: tErrors(result.error), error: true });
      }
    });
  }

  function save() {
    startTransition(async () => {
      const result = await setListAccess(listId, visibility, [...selected]);
      if (result.ok) onDone();
      else setNotice({ text: tErrors(result.error), error: true });
    });
  }

  function sub(person: ListAccess["people"][number]) {
    if (access.personal) return null;
    if (person.role === "owner") return t("adminSees");
    if (visibility === "place" && person.allLists) return t("memberSees");
    return person.allLists ? t("member") : t("limited");
  }

  return (
    <div className="flex max-h-[70dvh] flex-col gap-3.5 overflow-y-auto">
      {!access.personal && (
        <>
          <p className="text-[13px] text-muted-foreground">{access.placeName}</p>
          <div role="radiogroup" aria-label={t("group")} className="flex flex-col gap-2">
            {(["place", "selected"] as const).map((value) => {
              const on = visibility === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setVisibility(value)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-3 text-start transition-colors",
                    on && "border-primary bg-[#f3faf6]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-5.5 shrink-0 rounded-full border-2 border-[#c9cfcc] bg-card",
                      on && "border-[6px] border-primary",
                    )}
                  />
                  <span className="flex flex-col">
                    <span className="font-semibold">{t(value)}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {value === "place" ? t("placeHint") : t("selectedHint", { count: seeing, total: members.length })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {access.personal && access.people.length <= 1 && access.pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("onlyMe")}</p>
      ) : (
        <ul className="flex flex-col rounded-[18px] border bg-card px-3.5">
          {access.people.map((person) => {
            const isLocked = locked(person);
            const checked = isLocked || selected.has(person.id);
            const hint = sub(person);
            return (
              <li key={person.id} className="flex min-h-15 items-center gap-3 border-b py-2 last:border-b-0">
                <Initial name={person.name} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {person.name}
                    {person.id === userId && <span className="ms-1 font-normal text-muted-foreground">{t("me")}</span>}
                  </span>
                  {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
                </span>
                {isLocked ? (
                  <span
                    aria-label={t("always", { name: person.name })}
                    className="flex size-7 items-center justify-center rounded-lg bg-[#cfe7db] text-[#11684b]"
                  >
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                  </span>
                ) : (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={person.name}
                    onClick={() => toggle(person.id)}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg border-2 border-[#c9cfcc] bg-card",
                      checked && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {checked && <Check className="size-4" strokeWidth={3} aria-hidden />}
                  </button>
                )}
              </li>
            );
          })}
          {access.pending.map((address) => (
            <li key={address} className="flex min-h-15 items-center gap-3 border-b py-2 last:border-b-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#faf1de] text-[#8f6814]">
                <Mail className="size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span dir="ltr" className="truncate text-end font-semibold">
                  {address}
                </span>
                <span className="text-[13px] text-muted-foreground">{t("pending")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={invite} className="flex flex-col gap-2">
        <label htmlFor="list-invite" className="px-1 text-[13px] font-semibold text-muted-foreground">
          {t("inviteLabel")}
        </label>
        <div className="flex gap-2">
          <input
            id="list-invite"
            type="email"
            inputMode="email"
            autoComplete="off"
            dir="auto"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-[14px] border border-[#dfe3e1] bg-card px-3.5 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15"
          />
          <Button type="submit" size="xl" disabled={pending || !email.trim()} className="h-12 rounded-[14px] px-4">
            {t("invite")}
          </Button>
        </div>
        {notice && (
          <p role="status" className={cn("px-1 text-sm", notice.error ? "text-destructive" : "text-accent-foreground")}>
            {notice.text}
          </p>
        )}
      </form>

      <Button
        type="button"
        size="xl"
        disabled={pending}
        onClick={save}
        className="mt-1 h-13.5 w-full rounded-2xl bg-[#1d2522] text-base font-bold text-white hover:bg-[#1d2522]/90"
      >
        {t("save")}
      </Button>
    </div>
  );
}
