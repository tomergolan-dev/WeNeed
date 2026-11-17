"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Check, LoaderCircle, Sparkles, X } from "lucide-react";
import {
  askAssistant,
  removeAdded,
  setItemQuantity,
  type AddedItem,
  type AssistantReply,
  type Duplicate,
} from "@/app/assistant-actions";
import type { ActionResult } from "@/app/actions";
import { useDueText } from "@/components/chores/chore-due";
import { formatQuantity } from "@/lib/items";

type Exchange = {
  message: string;
  // When it was sent, for "today" and "tomorrow" in the reply.
  at: number;
  state: "pending" | "done" | "error";
  reply?: AssistantReply;
  error?: string;
  undone?: boolean;
  answered: Record<string, "increased" | "kept">;
};

/**
 * The list's AI chat, always at the bottom of the screen. The reply to the
 * last message shows above the bar, so the list stays in view.
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
  const [text, setText] = useState("");
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div className="pointer-events-auto mx-auto max-w-xl bg-gradient-to-t from-background from-60% to-transparent px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {exchange && (
          <section
            aria-live="polite"
            aria-label={t("replyLabel")}
            className="mb-2 max-h-[45vh] overflow-y-auto rounded-[22px] border bg-card p-3.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate pt-1 text-[13px] text-muted-foreground">
                “{exchange.message}”
              </p>
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
              onUndo={(ids) => call(() => removeAdded(listId, ids), () => update({ undone: true }))}
              onIncrease={(dup) =>
                call(
                  () => setItemQuantity(dup.itemId, dup.newQuantity!, dup.newUnit),
                  () => update({ answered: { ...exchange.answered, [dup.itemId]: "increased" } }),
                )
              }
              onKeep={(dup) => update({ answered: { ...exchange.answered, [dup.itemId]: "kept" } })}
            />
          </section>
        )}

        <form
          onSubmit={send}
          className="flex h-14 items-center gap-2 rounded-full border bg-card ps-2 pe-2 shadow-[0_6px_24px_-10px_rgba(0,0,0,0.22)] transition-colors focus-within:border-primary"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Sparkles className="size-[18px]" aria-hidden />
          </span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            aria-label={t("label")}
            maxLength={500}
            enterKeyHint="send"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
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

function ExchangeBody({
  exchange,
  chores,
  onUndo,
  onIncrease,
  onKeep,
}: {
  exchange: Exchange;
  chores: boolean;
  onUndo: (ids: string[]) => void;
  onIncrease: (duplicate: Duplicate) => void;
  onKeep: (duplicate: Duplicate) => void;
}) {
  const t = useTranslations("Assistant");
  const tItem = useTranslations("ItemForm");

  if (exchange.state === "pending") {
    return (
      <p className="mt-1 flex items-center gap-2 text-[15px] text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden />
        {t("thinking")}
      </p>
    );
  }
  if (exchange.state === "error") {
    return <p className="mt-1 text-[15px] text-destructive">{exchange.error}</p>;
  }

  const { added, duplicates, skipped } = exchange.reply!;
  if (added.length === 0 && duplicates.length === 0 && skipped.length === 0) {
    return <p className="mt-1 text-[15px]">{t("nothing")}</p>;
  }

  return (
    <div className="mt-1 flex flex-col gap-3 text-[15px]">
      {added.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{exchange.undone ? t("undone") : t(chores ? "addedChores" : "added", { count: added.length })}</p>
            {!exchange.undone && (
              <button
                type="button"
                onClick={() => onUndo(added.map((item) => item.id))}
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

      {skipped.length > 0 && <p className="text-muted-foreground">{t("skipped", { names: skipped.join(", ") })}</p>}
    </div>
  );
}

function AddedRow({ item, now, unitsLabel }: { item: AddedItem; now: number; unitsLabel: string }) {
  const dueText = useDueText();
  const detail = [
    formatQuantity(item, unitsLabel),
    item.dueDate ? dueText(item, now) : "",
    item.assignee ?? "",
  ]
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
