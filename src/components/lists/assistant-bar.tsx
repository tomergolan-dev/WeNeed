"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Check, LoaderCircle, PencilLine, Sparkles, X } from "lucide-react";
import { type AddedItem, type AssistantReply, type Change, type Duplicate } from "@/lib/assistant-plan";
import type { ActionResult } from "@/app/actions";
import { useBackend } from "@/components/lists/backend";
import { useDueText } from "@/components/chores/chore-due";
import { formatQuantity } from "@/lib/items";
import { cn } from "@/lib/utils";

type Exchange = {
  message: string;
  // When it was sent, for "today" and "tomorrow" in the reply.
  at: number;
  state: "pending" | "done" | "error";
  reply?: AssistantReply;
  error?: string;
  undone?: boolean;
  // Each "add more?" question by item id; the deletion question under "remove".
  answered: Record<string, "increased" | "kept" | "removed">;
};

// How long a short reply stays above the bar.
const NOTE_MS = 3000;
// The message box grows up to about four lines, then scrolls.
const MAX_INPUT_PX = 120;
const ERROR_MS = 5000;

/** A question the user still has to answer: "add 2 more?" or "delete these?". */
const isOpenQuestion = (exchange: Exchange) =>
  exchange.state === "done" &&
  (exchange.reply!.duplicates.some((dup) => dup.newQuantity !== null && !exchange.answered[dup.itemId]) ||
    (exchange.reply!.removals.length > 0 && !exchange.answered.remove));

/** "ביטול" for a reply: removes what it added and puts back what it changed. */
const undoOf = (reply: AssistantReply) => ({
  added: reply.added.map((item) => item.id),
  restore: reply.changed.map((change) => ({ itemId: change.itemId, fields: change.before })),
});

/**
 * The list's AI chat, always at the bottom of the screen. Its reply shows
 * above the bar: a short note that fades after a few seconds, or a card when
 * there is a question to answer, so the list stays in view.
 */
export function AssistantBar({
  listId,
  placeholder,
  chores = false,
}: {
  listId: string;
  placeholder: string;
  chores?: boolean;
}) {
  const t = useTranslations("Assistant");
  const tErrors = useTranslations("Errors");
  const { askAssistant, deleteItems, setItemQuantity, undoReply } = useBackend();
  const [text, setText] = useState("");
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Short replies close on their own; a reply with a question waits for the answer.
  useEffect(() => {
    if (!exchange || exchange.state === "pending" || isOpenQuestion(exchange)) return;
    const timer = setTimeout(() => setExchange(null), exchange.state === "error" ? ERROR_MS : NOTE_MS);
    return () => clearTimeout(timer);
  }, [exchange]);

  const update = (patch: Partial<Exchange>) => setExchange((current) => (current ? { ...current, ...patch } : current));

  const call = (action: () => Promise<ActionResult>, onDone: () => void) =>
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) onDone();
        else update({ state: "error", error: tErrors(result.error) });
      } catch {
        update({ state: "error", error: tErrors("generic") });
      }
    });

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const message = text.trim();
    if (!message || pending) return;
    setText("");
    if (inputRef.current) inputRef.current.style.height = "";
    setExchange({ message, at: Date.now(), state: "pending", answered: {} });
    startTransition(async () => {
      try {
        const result = await askAssistant(listId, message);
        setExchange((current) =>
          current?.message !== message
            ? current
            : result.ok
              ? { ...current, state: "done", reply: result.reply }
              : { ...current, state: "error", error: tErrors(result.error) },
        );
      } catch {
        update({ state: "error", error: tErrors("generic") });
      }
    });
  };

  return (
    <div data-chat className="pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:ps-72">
      <div className="pointer-events-auto mx-auto max-w-xl bg-gradient-to-t from-background from-60% to-transparent px-4 pt-5 lg:max-w-3xl lg:px-7 xl:max-w-4xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        {exchange && !isOpenQuestion(exchange) && (
          <Note
            exchange={exchange}
            chores={chores}
            onUndo={() =>
              call(
                () => undoReply(listId, undoOf(exchange.reply!)),
                () => update({ undone: true }),
              )
            }
          />
        )}
        {exchange && isOpenQuestion(exchange) && (
          <section
            aria-live="polite"
            aria-label={t("replyLabel")}
            className="mb-2 max-h-[45vh] overflow-y-auto rounded-[22px] border bg-card p-3.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate pt-1 text-[13px] text-muted-foreground">“{exchange.message}”</p>
              <button
                type="button"
                onClick={() => setExchange(null)}
                aria-label={t("close")}
                className="-me-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <ExchangeBody
              exchange={exchange}
              chores={chores}
              onUndo={() =>
                call(
                  () => undoReply(listId, undoOf(exchange.reply!)),
                  () => update({ undone: true }),
                )
              }
              onIncrease={(dup) =>
                call(
                  () => setItemQuantity(dup.itemId, dup.newQuantity!, dup.newUnit),
                  () => update({ answered: { ...exchange.answered, [dup.itemId]: "increased" } }),
                )
              }
              onKeep={(dup) => update({ answered: { ...exchange.answered, [dup.itemId]: "kept" } })}
              onRemove={(ids) =>
                call(
                  () => deleteItems(listId, ids),
                  () => update({ answered: { ...exchange.answered, remove: "removed" } }),
                )
              }
              onKeepAll={() => update({ answered: { ...exchange.answered, remove: "kept" } })}
            />
          </section>
        )}

        <form
          ref={formRef}
          onSubmit={send}
          className="flex min-h-14 items-end gap-2 rounded-[28px] border bg-card p-2 shadow-[0_6px_24px_-10px_rgba(0,0,0,0.22)] transition-colors focus-within:border-primary"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Sparkles className="size-[18px]" aria-hidden />
          </span>
          {/* Grows with the text, up to a few lines. Enter adds a line on phones
              (the arrow sends) and sends on a computer (Shift+Enter adds a line).
              While empty it is exactly one line tall (margin instead of padding),
              so a long example on a narrow phone never peeks a second line. */}
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              const el = e.target;
              el.style.height = "";
              el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_PX)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
              if (window.matchMedia("(pointer: coarse)").matches) return;
              e.preventDefault();
              formRef.current?.requestSubmit();
            }}
            placeholder={placeholder}
            aria-label={t("label")}
            maxLength={500}
            className="max-h-[120px] min-w-0 flex-1 resize-none self-center bg-transparent py-2 text-base leading-6 outline-none placeholder:text-sm placeholder:text-muted-foreground placeholder-shown:my-2 placeholder-shown:h-6 placeholder-shown:overflow-hidden placeholder-shown:py-0"
          />
          <button
            type="submit"
            disabled={!text.trim() || pending}
            aria-label={t("send")}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

/** A one-line reply: "Added: eggs, tomatoes · Undo". Closes on its own. */
function Note({ exchange, chores, onUndo }: { exchange: Exchange; chores: boolean; onUndo: () => void }) {
  const t = useTranslations("Assistant");
  const tItem = useTranslations("ItemForm");
  const describe = useChangeText(exchange.at);

  let icon: React.ReactNode = (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <Check className="size-3.5" strokeWidth={3} aria-hidden />
    </span>
  );
  let text: string;
  let undo = false;

  if (exchange.state === "pending") {
    icon = <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" aria-hidden />;
    text = t("thinking");
  } else if (exchange.state === "error") {
    icon = null;
    text = exchange.error ?? "";
  } else {
    const { added, duplicates, skipped, changed, removals, notFound } = exchange.reply!;
    const parts: string[] = [];
    if (exchange.undone) parts.push(t("undone"));
    else {
      if (added.length > 0)
        parts.push(t(chores ? "addedChoresShort" : "addedShort", { names: added.map((item) => item.name).join(", ") }));
      if (changed.length > 0)
        parts.push(t("changedShort", { changes: changed.map((c) => `${c.name} (${describe(c)})`).join(", ") }));
      undo = added.length + changed.length > 0;
    }
    if (removals.length > 0) {
      const names = removals.map((r) => r.name).join(", ");
      parts.push(exchange.answered.remove === "removed" ? t("removed", { names }) : t("removeKept", { names }));
    }
    for (const dup of duplicates) {
      const answer = exchange.answered[dup.itemId];
      if (answer === "increased") {
        parts.push(
          t("increasedShort", {
            name: dup.name,
            quantity: formatQuantity({ quantity: dup.newQuantity, unit: dup.newUnit }, tItem("units")),
          }),
        );
      } else {
        parts.push(t("skipped", { names: dup.name }));
      }
    }
    if (skipped.length > 0) parts.push(t("skipped", { names: skipped.join(", ") }));
    if (notFound.length > 0) parts.push(t("notFound", { names: notFound.join(", ") }));
    if (parts.length === 0) {
      icon = null;
      parts.push(t("nothing"));
    }
    text = parts.join(" · ");
  }

  return (
    <div
      role="status"
      className={cn(
        "mb-2 flex animate-in items-center gap-2.5 rounded-2xl border bg-card py-2 ps-3 pe-2 text-sm shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] fade-in slide-in-from-bottom-1",
        exchange.state === "error" && "text-destructive",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate py-1">{text}</span>
      {undo && (
        <button
          type="button"
          onClick={onUndo}
          className="h-8 shrink-0 rounded-lg px-2 text-sm font-semibold text-accent-foreground active:bg-accent"
        >
          {t("undo")}
        </button>
      )}
    </div>
  );
}

function ExchangeBody({
  exchange,
  chores,
  onUndo,
  onIncrease,
  onKeep,
  onRemove,
  onKeepAll,
}: {
  exchange: Exchange;
  chores: boolean;
  onUndo: () => void;
  onIncrease: (duplicate: Duplicate) => void;
  onKeep: (duplicate: Duplicate) => void;
  onRemove: (ids: string[]) => void;
  onKeepAll: () => void;
}) {
  const t = useTranslations("Assistant");
  const tItem = useTranslations("ItemForm");

  // Shown only while a question is open, so there is always a reply here.
  const { added, duplicates, skipped, changed, removals, notFound } = exchange.reply!;
  const title = [
    added.length > 0 && t(chores ? "addedChores" : "added", { count: added.length }),
    changed.length > 0 && t("changed", { count: changed.length }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-1 flex flex-col gap-3 text-[15px]">
      {added.length + changed.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{exchange.undone ? t("undone") : title}</p>
            {!exchange.undone && (
              <button
                type="button"
                onClick={onUndo}
                className="h-8 shrink-0 rounded-lg px-2 text-sm font-semibold text-accent-foreground active:bg-accent"
              >
                {t("undo")}
              </button>
            )}
          </div>
          {!exchange.undone && (
            <ul className="mt-1">
              {added.map((item) => (
                <AddedRow key={item.id} item={item} now={exchange.at} unitsLabel={tItem("units")} />
              ))}
              {changed.map((change) => (
                <ChangeRow key={change.itemId} change={change} now={exchange.at} />
              ))}
            </ul>
          )}
        </div>
      )}

      {duplicates.map((dup) => {
        const answer = exchange.answered[dup.itemId];
        const now = formatQuantity(dup, tItem("units"));
        return (
          <div key={dup.itemId}>
            <p>
              {now
                ? t.rich("alreadyWith", { name: dup.name, quantity: now, b: (c) => <strong>{c}</strong> })
                : t.rich("already", { name: dup.name, b: (c) => <strong>{c}</strong> })}
              {dup.newQuantity !== null && !answer && ` ${t("addMore")}`}
            </p>
            {dup.newQuantity !== null &&
              (answer ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {answer === "increased"
                    ? t("increased", {
                        quantity: formatQuantity({ quantity: dup.newQuantity, unit: dup.newUnit }, tItem("units")),
                      })
                    : t("kept")}
                </p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onIncrease(dup)}
                    className="h-10 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
                  >
                    {t("yesTotal", {
                      quantity: formatQuantity({ quantity: dup.newQuantity, unit: dup.newUnit }, tItem("units")),
                    })}
                  </button>
                  <button
                    type="button"
                    onClick={() => onKeep(dup)}
                    className="h-10 rounded-xl border bg-card px-3.5 text-sm font-semibold"
                  >
                    {t("keep")}
                  </button>
                </div>
              ))}
          </div>
        );
      })}

      {removals.length > 0 && (
        <div>
          <p>
            {t.rich("removeQuestion", {
              names: removals.map((r) => r.name).join(", "),
              b: (c) => <strong>{c}</strong>,
            })}
          </p>
          {exchange.answered.remove ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {exchange.answered.remove === "removed" ? t("removedDone") : t("kept")}
            </p>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onRemove(removals.map((r) => r.itemId))}
                className="h-10 rounded-xl bg-destructive px-3.5 text-sm font-semibold text-white"
              >
                {t("removeYes")}
              </button>
              <button
                type="button"
                onClick={onKeepAll}
                className="h-10 rounded-xl border bg-card px-3.5 text-sm font-semibold"
              >
                {t("keep")}
              </button>
            </div>
          )}
        </div>
      )}

      {skipped.length > 0 && <p className="text-muted-foreground">{t("skipped", { names: skipped.join(", ") })}</p>}
      {notFound.length > 0 && <p className="text-muted-foreground">{t("notFound", { names: notFound.join(", ") })}</p>}
    </div>
  );
}

/** What a change did, in a few words: "סומן", "3 יח׳", "מחר, 08:00", "דני". */
function useChangeText(now: number) {
  const t = useTranslations("Assistant");
  const tItem = useTranslations("ItemForm");
  const dueText = useDueText();
  return ({ patch, assignee }: Change) => {
    const parts: string[] = [];
    if (patch.done !== undefined) parts.push(patch.done ? t("checked") : t("unchecked"));
    if (patch.name !== undefined) parts.push(t("renamed", { name: patch.name }));
    if (patch.quantity !== undefined)
      parts.push(formatQuantity({ quantity: patch.quantity, unit: patch.unit ?? null }, tItem("units")));
    if (patch.dueDate !== undefined || patch.dueTime !== undefined)
      parts.push(
        patch.dueDate ? dueText({ dueDate: patch.dueDate, dueTime: patch.dueTime ?? null }, now) : t("noDate"),
      );
    if (patch.assigneeId !== undefined) parts.push(assignee ?? t("noAssignee"));
    return parts.join(", ");
  };
}

function ChangeRow({ change, now }: { change: Change; now: number }) {
  const describe = useChangeText(now);
  return (
    <li className="flex items-center gap-2.5 border-t border-[#f0f2f1] py-2 first:border-t-0">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <PencilLine className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{change.name}</span>
      <span className="shrink-0 text-sm text-muted-foreground">{describe(change)}</span>
    </li>
  );
}

function AddedRow({ item, now, unitsLabel }: { item: AddedItem; now: number; unitsLabel: string }) {
  const dueText = useDueText();
  const detail = [formatQuantity(item, unitsLabel), item.dueDate ? dueText(item, now) : "", item.assignee ?? ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center gap-2.5 border-t border-[#f0f2f1] py-2 first:border-t-0">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      {detail && <span className="shrink-0 text-sm text-muted-foreground">{detail}</span>}
    </li>
  );
}
