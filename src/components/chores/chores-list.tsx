"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BellRing, CalendarCheck, CalendarDays, Check, Clock } from "lucide-react";
import type { ChoreInput } from "@/app/actions";
import { useBackend } from "@/components/lists/backend";
import type { Item } from "@/db/schema";
import { BottomSheet } from "@/components/bottom-sheet";
import { ClipChip, DetailsButton } from "@/components/lists/item-details";
import {
  longPressRow,
  SelectBar,
  SelectCircle,
  SelectionProvider,
  useLongPressPick,
  useSelection,
  type Selection,
} from "@/components/lists/bulk-delete";
import { useAddedBy } from "@/components/lists/added-by";
import { useMe } from "@/components/lists/me";
import { AssistantBar } from "@/components/lists/assistant-bar";
import { ListScreen } from "@/components/lists/list-screen";
import { ListTop } from "@/components/lists/list-top";
import { chipClass, OptionChip, PickerChip, QuickAdd } from "@/components/lists/quick-add";
import { draftItem, isDraft, useListItems } from "@/components/lists/use-list-items";
import { Button } from "@/components/ui/button";
import { dueAt, dueStatus, todayIn, type DueStatus } from "@/lib/due";
import { cn } from "@/lib/utils";
import { ChoreFields, emptyChore, toChoreInput, type ChoreDraft } from "./chore-fields";
import { DuePill, useDueText } from "./chore-due";

type Person = { id: string; name: string };
type Filter = "all" | "mine" | "soon" | "overdue";
type Sort = "date" | "added";

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

/** A date `days` after `date`, both YYYY-MM-DD. */
function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function ChoresList({
  listId,
  header,
  items,
  people,
}: {
  listId: string;
  header: React.ReactNode;
  items: Item[];
  people: Person[];
}) {
  const t = useTranslations("Chores");
  const { addChore, deleteItem, deleteItems, setItemDone, updateChore } = useBackend();
  const { items: chores, run, error } = useListItems(items);
  const selection = useSelection(chores);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("date");
  const [editing, setEditing] = useState<Item | null>(null);
  const addedBy = useAddedBy(editing, people, true);
  const [draft, setDraft] = useState<ChoreDraft>(emptyChore);
  const setField = (patch: Partial<ChoreDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const now = useNow();
  const dueText = useDueText();
  const today = todayIn(now);
  const tomorrow = addDays(today, 1);
  const pickDate = (date: string) =>
    setField({ dueDate: draft.dueDate === date ? "" : date, dueTime: draft.dueDate === date ? "" : draft.dueTime });

  const add = (input: ChoreInput) =>
    run({ type: "add", item: draftItem({ ...patchOf(input), name: input.title }) }, () => addChore(listId, input));

  const withStatus = chores.map((chore) => ({ chore, status: dueStatus(chore, now) }));
  // Chores arrive in the order they were added. By date: overdue, soon, later
  // by due time, then those without a date; ties keep the order added.
  const open = withStatus.filter(({ chore }) => !chore.done);
  if (sort === "date") {
    open.sort(
      (a, b) =>
        RANK[a.status] - RANK[b.status] ||
        (a.chore.dueDate && b.chore.dueDate
          ? dueAt(a.chore.dueDate, a.chore.dueTime) - dueAt(b.chore.dueDate, b.chore.dueTime)
          : 0),
    );
  }
  const done = withStatus.filter(({ chore }) => chore.done);
  const counts = {
    overdue: open.filter((c) => c.status === "overdue").length,
    soon: open.filter((c) => c.status === "soon").length,
  };
  const me = useMe();
  // "Mine" only means something when there is someone else to assign tasks to.
  const canFilterMine = people.length > 1 && people.some((person) => person.id === me);
  const shown = open.filter(({ chore, status }) =>
    filter === "all" ? true : filter === "mine" ? chore.assigneeId === me : status === filter,
  );

  const rowProps = {
    now,
    people,
    selection,
    onToggle: (chore: Item) =>
      run({ type: "patch", id: chore.id, patch: { done: !chore.done } }, () => setItemDone(chore.id, !chore.done)),
    onEdit: setEditing,
  };

  const quickInput = toChoreInput(draft);

  return (
    <SelectionProvider value={{ selection }}>
      <ListScreen>
        <ListTop header={header}>
          <QuickAdd
            placeholder={t("quickAddPlaceholder")}
            value={draft.title}
            onChange={(title) => setField({ title })}
            canSubmit={quickInput !== null}
            onSubmit={() => {
              if (!quickInput) return;
              add(quickInput);
              setDraft(emptyChore);
            }}
            options={
              <>
                <OptionChip on={draft.dueDate === today} onClick={() => pickDate(today)}>
                  {t("today")}
                </OptionChip>
                <OptionChip on={draft.dueDate === tomorrow} onClick={() => pickDate(tomorrow)}>
                  {t("tomorrow")}
                </OptionChip>
                <PickerChip
                  type="date"
                  value={draft.dueDate === today || draft.dueDate === tomorrow ? "" : draft.dueDate}
                  onChange={(dueDate) => setField({ dueDate, dueTime: dueDate ? draft.dueTime : "" })}
                  label={t("date")}
                  text={
                    <>
                      <CalendarDays className="size-4" aria-hidden />
                      {draft.dueDate && draft.dueDate !== today && draft.dueDate !== tomorrow
                        ? dueText({ dueDate: draft.dueDate, dueTime: null }, now)
                        : t("otherDate")}
                    </>
                  }
                />
                {draft.dueDate && (
                  <PickerChip
                    type="time"
                    value={draft.dueTime}
                    onChange={(dueTime) => setField({ dueTime })}
                    label={t("time")}
                    text={
                      <>
                        <Clock className="size-4" aria-hidden />
                        {draft.dueTime || t("time")}
                      </>
                    }
                  />
                )}
                {people.length > 1 && (
                  <select
                    value={draft.assigneeId}
                    onChange={(e) => setField({ assigneeId: e.target.value })}
                    aria-label={t("assignee")}
                    className={`${chipClass} appearance-none pe-3`}
                  >
                    <option value="">{t("assignee")}</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            }
          />
        </ListTop>
        <div data-list-body>
          {/* The main filters in one quiet row, styled like the sort switch. */}
          <div className="px-5 pt-3 lg:px-8">
            <div
              role="group"
              aria-label={t("filters")}
              className="flex gap-0.5 overflow-x-auto rounded-full bg-muted p-0.5 [scrollbar-width:none]"
            >
              <FilterButton on={filter === "all"} onClick={() => setFilter("all")}>
                {t("all")}
              </FilterButton>
              {canFilterMine && (
                <FilterButton on={filter === "mine"} onClick={() => setFilter("mine")}>
                  {t("filterMine")}
                </FilterButton>
              )}
              <FilterButton
                on={filter === "soon"}
                onClick={() => setFilter("soon")}
                dot="bg-[#e0a21b]"
                count={counts.soon}
              >
                {t("soon")}
              </FilterButton>
              <FilterButton
                on={filter === "overdue"}
                onClick={() => setFilter("overdue")}
                dot="bg-[#d9452f]"
                count={counts.overdue}
              >
                {t("overdue")}
              </FilterButton>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-5 pt-4 pb-40 lg:px-8">
            {error && <p className="text-sm text-destructive">{error}</p>}

            {chores.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <span className="flex size-14 items-center justify-center rounded-full bg-[#f0ecf7] text-[#6a5794]">
                  <CalendarCheck className="size-6" aria-hidden />
                </span>
                {t("empty")}
              </div>
            )}

            {shown.length > 0 && (
              <section>
                <div className="mb-2 flex flex-col gap-2 px-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[13px] font-semibold text-muted-foreground">{t("open")}</h2>
                    <div className="flex items-center gap-1.5">
                      <div role="group" aria-label={t("sortBy")} className="flex rounded-full bg-muted p-0.5">
                        {(["date", "added"] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={sort === option}
                            onClick={() => setSort(option)}
                            className={cn(
                              "h-7 rounded-full px-2.5 text-xs text-muted-foreground transition-colors",
                              sort === option && "bg-card text-foreground shadow-sm",
                            )}
                          >
                            {option === "date" ? t("sortDate") : t("sortAdded")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <SelectBar
                    selection={selection}
                    onDelete={(ids) => run({ type: "deleteMany", ids }, () => deleteItems(listId, ids))}
                  />
                </div>
                <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card">
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
                <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                  {done.map(({ chore, status }) => (
                    <ChoreRow key={chore.id} chore={chore} status={status} {...rowProps} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        <AssistantBar listId={listId} placeholder={t("aiPlaceholder")} chores />

        <BottomSheet
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          title={t("editTitle")}
          subtitle={addedBy}
        >
          {editing && (
            <div className="flex flex-col gap-4">
              <DetailsButton item={editing} onOpen={() => setEditing(null)} onEdit={() => setEditing(editing)} />
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
              <RemindButton chore={editing} people={people} />
            </div>
          )}
        </BottomSheet>
      </ListScreen>
    </SelectionProvider>
  );
}

function FilterButton({
  on,
  onClick,
  dot,
  count,
  children,
}: {
  on: boolean;
  onClick: () => void;
  dot?: string;
  /** Shown only when there is something to count. */
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-7 flex-1 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs whitespace-nowrap text-muted-foreground transition-colors",
        on && "bg-card font-medium text-foreground shadow-sm",
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />}
      {children}
      {count ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}

function ChoreRow({
  chore,
  status,
  now,
  people,
  selection,
  onToggle,
  onEdit,
}: {
  chore: Item;
  status: DueStatus;
  now: number;
  people: Person[];
  /** While picking tasks to delete: the row picks instead of checking or editing. */
  selection: Selection;
  onToggle: (chore: Item) => void;
  onEdit: (chore: Item) => void;
}) {
  const dueText = useDueText();
  const assignee = people.find((p) => p.id === chore.assigneeId)?.name;
  const draft = isDraft(chore);
  const open = () => (selection.selecting ? selection.toggle(chore.id) : onEdit(chore));
  const longPress = useLongPressPick(selection, chore.id, draft);

  return (
    <li
      {...longPress}
      className={cn(
        "flex items-start gap-3 border-b border-[#f0f2f1] px-3.5 py-3 last:border-b-0",
        longPressRow,
        status === "overdue" && "shadow-[inset_-4px_0_0_#d9452f] ltr:shadow-[inset_4px_0_0_#d9452f]",
        status === "soon" && "shadow-[inset_-4px_0_0_#e0a21b] ltr:shadow-[inset_4px_0_0_#e0a21b]",
      )}
    >
      {selection.selecting ? (
        <SelectCircle item={chore} selection={selection} className="mt-px" />
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={chore.done}
          aria-label={chore.name}
          disabled={draft}
          onClick={() => onToggle(chore)}
          className={cn(
            "mt-px flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c9cfcc] bg-card text-primary-foreground transition-colors",
            chore.done && "border-primary bg-primary",
          )}
        >
          {chore.done && <Check className="size-4" strokeWidth={3} aria-hidden />}
        </button>
      )}
      <div
        onClick={() => !draft && open()}
        className={cn("flex min-w-0 flex-1 cursor-pointer flex-col items-start text-start", draft && "opacity-60")}
      >
        <span className="flex max-w-full items-center gap-2">
          <button
            type="button"
            disabled={draft}
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className={cn(
              "min-w-0 text-start text-base",
              chore.done && "text-muted-foreground line-through",
            )}
          >
            {chore.name}
          </button>
          {!draft && !selection.selecting && <ClipChip item={chore} onEdit={() => onEdit(chore)} />}
        </span>
        {!chore.done && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            <DuePill chore={chore} status={status} now={now} />
            <span suppressHydrationWarning>{dueText(chore, now)}</span>
            {assignee && <span>· {assignee}</span>}
          </span>
        )}
      </div>
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

/** "Email a reminder to Tamir", for a task assigned to someone else. Not in the demo. */
function RemindButton({ chore, people }: { chore: Item; people: Person[] }) {
  const t = useTranslations("Chores");
  const tErrors = useTranslations("Errors");
  const { remindAssignee } = useBackend();
  const me = useMe();
  const [state, setState] = useState<{ pending: boolean; note?: string; error?: boolean }>({ pending: false });
  const assignee = people.find((person) => person.id === chore.assigneeId);
  if (!remindAssignee || !assignee || assignee.id === me || chore.done || isDraft(chore)) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={state.pending}
        onClick={async () => {
          setState({ pending: true });
          const result = await remindAssignee(chore.id);
          setState(
            result.ok
              ? { pending: false, note: t("reminded", { name: assignee.name }) }
              : { pending: false, note: tErrors(result.error), error: true },
          );
        }}
        className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-accent-foreground transition-colors active:bg-muted disabled:opacity-50"
      >
        <BellRing className="size-4" aria-hidden />
        {t("remind", { name: assignee.name })}
      </button>
      {state.note && (
        <p
          role="status"
          className={cn("text-center text-xs", state.error ? "text-destructive" : "text-muted-foreground")}
        >
          {state.note}
        </p>
      )}
    </div>
  );
}
