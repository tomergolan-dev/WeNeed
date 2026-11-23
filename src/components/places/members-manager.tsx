"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Mail } from "lucide-react";
import { cn } from "cn";
import { cancelInvite, inviteToPlace, removeMember, setMemberRole } from "@/app/sharing-actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { Initial } from "@/components/people";
import { Button } from "@/components/ui/button";

type Member = { id: string; name: string; role: "owner" | "member"; allLists: boolean; lists: string[] };
type PendingInvite = { id: string; email: string; lists: string[] | null; when: string };

const card = "rounded-2xl border border-border/60 bg-card";
const heading = "px-1 pb-2 text-[13px] font-semibold text-muted-foreground";

/** Members of a shared place: inviting (admins), roles, and pending invites. */
export function MembersManager({
  userId,
  admin,
  members,
  invites,
  lists,
}: {
  userId: string;
  admin: boolean;
  members: Member[];
  invites: PendingInvite[];
  lists: { id: string; name: string }[];
}) {
  const t = useTranslations("Members");
  const tErrors = useTranslations("Errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: Parameters<typeof tErrors>[0] }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) after?.();
      else setError(tErrors(result.error));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {admin && <InviteCard lists={lists} />}

      <section>
        <h2 className={heading}>{t("members", { count: members.length })}</h2>
        <ul className={cn(card, "px-3.5")}>
          {members.map((m) => {
            const sees =
              m.role === "owner" || m.allLists
                ? t("allLists")
                : m.lists.length > 0
                  ? t("sees", { lists: m.lists.join(", ") })
                  : t("seesNothing");
            const role = m.role === "owner" ? t("admin") : t("member");
            return (
              <li key={m.id} className="flex min-h-13 items-center gap-3 border-b border-border/60 py-2 last:border-b-0">
                <Initial name={m.name} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium">
                    {m.name}
                    {m.id === userId && <span className="ms-1 font-normal text-muted-foreground">{t("me")}</span>}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">{sees}</span>
                </span>
                {admin && m.id !== userId ? (
                  <button
                    type="button"
                    aria-label={t("roleFor", { name: m.name })}
                    onClick={() => {
                      setError(null);
                      setConfirmRemove(false);
                      setEditing(m);
                    }}
                    className="flex h-8 items-center gap-1 rounded-[10px] border border-border/60 bg-card px-2.5 text-[13px]"
                  >
                    {role}
                    <ChevronDown className="size-3.5" aria-hidden />
                  </button>
                ) : (
                  <span
                    className={cn(
                      "rounded-[10px] px-2.5 py-1 text-[13px] font-medium",
                      m.role === "owner" ? "bg-accent text-accent-foreground" : "bg-[#eceff0] text-[#4c5853]",
                    )}
                  >
                    {role}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {invites.length > 0 && (
        <section>
          <h2 className={heading}>{t("pending", { count: invites.length })}</h2>
          <ul className={cn(card, "px-3.5")}>
            {invites.map((invite) => (
              <li key={invite.id} className="flex min-h-13 items-center gap-3 border-b border-border/60 py-2 last:border-b-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#faf1de] text-[#8f6814]">
                  <Mail className="size-4" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span dir="ltr" className="truncate text-end font-medium">
                    {invite.email}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {invite.lists === null ? t("invitedToPlace") : t("invitedToLists", { lists: invite.lists.join(", ") })} ·{" "}
                    {invite.when}
                  </span>
                </span>
                {admin && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => cancelInvite(invite.id))}
                    className="h-8.5 px-1 text-sm font-semibold text-destructive"
                  >
                    {t("cancel")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && !editing && <p className="text-sm text-destructive">{error}</p>}
      <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">{t("roles")}</p>

      <BottomSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? t("roleFor", { name: editing.name }) : ""}
      >
        {editing && (
          <div className="flex flex-col gap-2.5">
            {(["owner", "member"] as const).map((role) => {
              const on = editing.role === role;
              return (
                <button
                  key={role}
                  type="button"
                  disabled={pending}
                  onClick={() => (on ? setEditing(null) : run(() => setMemberRole(editing.id, role), () => setEditing(null)))}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-start",
                    on && "border-2 border-primary px-[15px] py-[11px]",
                  )}
                >
                  <span className="flex flex-1 flex-col">
                    <span className="font-medium">{role === "owner" ? t("admin") : t("member")}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {role === "owner" ? t("adminHint") : t("memberHint")}
                    </span>
                  </span>
                  {on && <Check className="size-5 text-primary" strokeWidth={3} aria-hidden />}
                </button>
              );
            })}
            {confirmRemove ? (
              <div className="mt-2 flex flex-col gap-2.5">
                <p className="text-sm text-muted-foreground">{t("removeHint", { name: editing.name })}</p>
                <Button
                  type="button"
                  variant="destructive"
                  size="xl"
                  disabled={pending}
                  onClick={() => run(() => removeMember(editing.id), () => setEditing(null))}
                >
                  {t("removeConfirm", { name: editing.name })}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="mt-2 h-11 font-medium text-destructive"
              >
                {t("remove")}
              </button>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

/** "Invite a member": an email, to the whole place or to some lists. */
function InviteCard({ lists }: { lists: { id: string; name: string }[] }) {
  const t = useTranslations("Members");
  const tErrors = useTranslations("Errors");
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<"place" | "lists">("place");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = email.trim() !== "" && (scope === "place" || picked.size > 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    startTransition(async () => {
      const result = await inviteToPlace(email, scope === "place" ? null : [...picked]);
      if (result.ok) {
        setEmail("");
        setPicked(new Set());
        setNotice({ text: result.added ? t("added") : t("sent") });
      } else {
        setNotice({ text: tErrors(result.error), error: true });
      }
    });
  }

  return (
    <form onSubmit={submit} className={cn(card, "p-3.5")}>
      <label htmlFor="invite-email" className="block text-sm font-semibold">
        {t("inviteTitle")}
      </label>
      <input
        id="invite-email"
        type="email"
        inputMode="email"
        autoComplete="off"
        dir="auto"
        placeholder={t("emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-2.5 h-11 w-full rounded-xl border border-border/70 bg-card px-3.5 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15"
      />
      <div role="group" aria-label={t("to")} className="mt-2.5 flex gap-[3px] rounded-xl bg-[#eceff0] p-[3px]">
        {(["place", "lists"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
            className={cn(
              "h-8 flex-1 rounded-[9px] text-[13px] font-medium text-muted-foreground",
              scope === value && "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08)]",
            )}
          >
            {value === "place" ? t("toPlace") : t("toLists")}
          </button>
        ))}
      </div>
      {scope === "lists" && (
        <div role="group" aria-label={t("pickLists")} className="mt-2.5 flex flex-wrap gap-2">
          {lists.map((list) => {
            const on = picked.has(list.id);
            return (
              <button
                key={list.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setPicked((current) => {
                    const next = new Set(current);
                    if (on) next.delete(list.id);
                    else next.add(list.id);
                    return next;
                  })
                }
                className={cn(
                  "flex h-8 items-center gap-1 rounded-full border border-border/60 bg-card px-3 text-[13px]",
                  on && "border-primary bg-accent text-accent-foreground",
                )}
              >
                {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                {list.name}
              </button>
            );
          })}
        </div>
      )}
      <Button type="submit" size="xl" disabled={pending || !ready} className="mt-2.5 w-full">
        {t("send")}
      </Button>
      {notice && (
        <p role="status" className={cn("mt-2 text-sm", notice.error ? "text-destructive" : "text-accent-foreground")}>
          {notice.text}
        </p>
      )}
    </form>
  );
}
