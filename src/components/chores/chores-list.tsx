"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ListTodo } from "lucide-react";
import { addChore, deleteItem, setItemDone, updateChore, type ChoreInput } from "@/app/actions";
import type { Item } from "@/db/schema";
import { BottomSheet } from "@/components/bottom-sheet";
import { AddItemBar } from "@/components/lists/add-item-bar";
import { draftItem, isDraft, useListItems } from "@/components/lists/use-list-items";
import { Button } from "@/components/ui/button";
import { dueAt, dueStatus, type DueStatus } from "@/lib/due";
import { cn } from "@/lib/utils";
import { ChoreFields, emptyChore, toChoreInput, type ChoreDraft } from "./chore-fields";
import { DuePill, useDueText } from "./chore-due";

type Person = { id: string; name: string };
type Filter = "all" | "overdue" | "soon" | "noDate";

const RANK: Record<DueStatus, number> = { overdue: 0, soon: 1, later: 2, none: 3 };

/** Re-renders every minute, so "soon" and "overdue" stay current. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function patchOf(input: ChoreInput): Partial<Item> {
  return {
    name: input.title,
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    dueTime: input.dueTime ? `${input.dueTime}:00` : null,
  };
}

export function ChoresList({ listId, items, people }: { listId: string; items: Item[]; people: Person[] }) {
  const t = useTranslations("Chores");
  const { items: chores, run, error } = useListItems(items);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Item | null>(null);
  const now = useNow();

  const add = (input: ChoreInput) =>
    run({ type: "add", item: draftItem({ ...patchOf(input), name: input.title }) }, () => addChore(listId, input));

  const withStatus = chores.map((chore) => ({ chore, status: dueStatus(chore, now) }));
  const open = withStatus
    .filter(({ chore }) => !chore.done)
    .sort(
      (a, b) =>
        RANK[a.status] - RANK[b.status] ||
        (a.chore.dueDate && b.chore.dueDate
          ? dueAt(a.chore.dueDate, a.chore.dueTime) - dueAt(b.chore.dueDate, b.chore.dueTime)
          : 0),
    );
  const done = withStatus.filter(({ chore }) => chore.done);
  const counts = {
    overdue: open.filter((c) => c.status === "overdue").length,
    soon: open.filter((c) => c.status === "soon").length,
  };
  const shown = open.filter(({ chore, status }) =>
    filter === "all" ? true : filter === "noDate" ? !chore.dueDate : status === filter,
  );

  const rowProps = {
    now,
    people,
    onToggle: (chore: Item) =>
      run({ type: "patch", id: chore.id, patch: { done: !chore.done } }, () => setItemDone(chore.id, !chore.done)),
    onEdit: setEditing,
  };

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-5 pt-3.5 [scrollbar-width:none]">
        <Chip on={filter === "all"} onClick={() => setFilter("all")}>
          {t("all")}
        </Chip>
        <Chip on={filter === "overdue"} onClick={() => setFilter("overdue")} dot="bg-[#d9452f]">
          {t("filterOverdue", { count: counts.overdue })}
        </Chip>
        <Chip on={filter === "soon"} onClick={() => setFilter("soon")} dot="bg-[#e0a21b]">
          {t("filterSoon", { count: counts.soon })}
        </Chip>
        <Chip on={filter === "noDate"} onClick={() => setFilter("noDate")}>
          {t("noDate")}
        </Chip>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-4 pb-32">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {chores.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <span className="flex size-14 items-center justify-center rounded-full bg-[#f0ecf7] text-[#6a5794]">
              <ListTodo className="size-6" aria-hidden />
            </span>
            {t("empty")}
          </div>
        )}

        {shown.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">{t("open")}</h2>
            <ul className="overflow-hidden rounded-[18px] border bg-card shadow-soft">
              {shown.map(({ chore, status }) => (
                <ChoreRow key={chore.id} chore={chore} status={status} {...rowProps} />
              ))}
            </ul>
          </section>
        )}
        {chores.length > 0 && shown.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">{t("nothingHere")}</p>
        )}

        {done.length > 0 && filter === "all" && (
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">{t("done")}</h2>
            <ul className="overflow-hidden rounded-[18px] border bg-card shadow-soft">
              {done.map(({ chore, status }) => (
                <ChoreRow key={chore.id} chore={chore} status={status} {...rowProps} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <AddItemBar
        placeholder={t("addPlaceholder")}
        onAdd={(title) => add({ title, assigneeId: null, dueDate: null, dueTime: null })}
        details={{
          title: t("newTitle"),
          render: (close) => (
            <ChoreForm
              initial={emptyChore}
              people={people}
              submitLabel={t("add")}
              onSubmit={(input) => {
                add(input);
                close();
              }}
            />
          ),
        }}
      />

      <BottomSheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={t("editTitle")}>
        {editing && (
          <ChoreForm
            initial={{
              title: editing.name,
              dueDate: editing.dueDate ?? "",
              dueTime: editing.dueTime?.slice(0, 5) ?? "",
              assigneeId: editing.assigneeId ?? "",
            }}
            people={people}
            submitLabel={t("save")}
            onSubmit={(input) => {
              const id = editing.id;
              run({ type: "patch", id, patch: patchOf(input) }, () => updateChore(id, input));
              setEditing(null);
            }}
            onDelete={() => {
              const id = editing.id;
              run({ type: "delete", id }, () => deleteItem(id));
              setEditing(null);
            }}
          />
        )}
      </BottomSheet>
    </>
  );
}

function Chip({
  on,
  onClick,
  dot,
  children,
}: {
  on: boolean;
  onClick: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium transition-colors",
        on && "border-foreground bg-foreground text-background",
      )}
    >
      {dot && <span className={cn("size-2 rounded-full", dot)} aria-hidden />}
      {children}
    </button>
  );
}

function ChoreRow({
  chore,
  status,
  now,
  people,
  onToggle,
  onEdit,
}: {
  chore: Item;
  status: DueStatus;
  now: number;
  people: Person[];
  onToggle: (chore: Item) => void;
  onEdit: (chore: Item) => void;
}) {
  const dueText = useDueText();
  const assignee = people.find((p) => p.id === chore.assigneeId)?.name;
  const draft = isDraft(chore);

  return (
    <li
      className={cn(
        "flex items-start gap-3 border-b border-[#f0f2f1] px-3.5 py-3 last:border-b-0",
        status === "overdue" && "shadow-[inset_-4px_0_0_#d9452f] ltr:shadow-[inset_4px_0_0_#d9452f]",
        status === "soon" && "shadow-[inset_-4px_0_0_#e0a21b] ltr:shadow-[inset_4px_0_0_#e0a21b]",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={chore.done}
        aria-label={chore.name}
        disabled={draft}
        onClick={() => onToggle(chore)}
        className={cn(
          "mt-px flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 border-[#c9cfcc] bg-card text-primary-foreground transition-colors",
          chore.done && "border-primary bg-primary",
        )}
      >
        {chore.done && <Check className="size-4" strokeWidth={3} aria-hidden />}
      </button>
      <button
        type="button"
        disabled={draft}
        onClick={() => onEdit(chore)}
        className={cn("flex min-w-0 flex-1 flex-col items-start text-start", draft && "opacity-60")}
      >
        <span className={cn("text-base font-medium", chore.done && "text-muted-foreground line-through")}>
          {chore.name}
        </span>
        {!chore.done && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            <DuePill chore={chore} status={status} now={now} />
            <span suppressHydrationWarning>{dueText(chore, now)}</span>
            {assignee && <span>· {assignee}</span>}
          </span>
        )}
      </button>
    </li>
  );
}

function ChoreForm({
  initial,
  people,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  initial: ChoreDraft;
  people: Person[];
  submitLabel: string;
  onSubmit: (input: ChoreInput) => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("Chores");
  const [draft, setDraft] = useState(initial);
  const input = toChoreInput(draft);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (input) onSubmit(input);
      }}
    >
      <ChoreFields draft={draft} onChange={setDraft} people={people} />
      <div className="flex gap-2">
        {onDelete && (
          <Button type="button" variant="outline" size="xl" className="text-destructive" onClick={onDelete}>
            {t("delete")}
          </Button>
        )}
        <Button type="submit" size="xl" className="flex-1" disabled={!input}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
