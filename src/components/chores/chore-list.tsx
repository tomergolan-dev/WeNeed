"use client";

import { useId, useOptimistic, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import {
  addChore,
  deleteItem,
  setItemDone,
  updateChore,
  type ActionResult,
  type ChoreInput,
} from "@/app/actions";
import type { Item } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string };

type OptimisticAction =
  | { type: "add"; chore: Item }
  | { type: "update"; id: string; input: ChoreInput }
  | { type: "done"; id: string; done: boolean }
  | { type: "delete"; id: string };

function reduce(chores: Item[], action: OptimisticAction): Item[] {
  switch (action.type) {
    case "add":
      return [...chores, action.chore];
    case "update":
      return chores.map((chore) =>
        chore.id === action.id
          ? { ...chore, name: action.input.title, assigneeId: action.input.assigneeId }
          : chore,
      );
    case "done":
      return chores.map((chore) => (chore.id === action.id ? { ...chore, done: action.done } : chore));
    case "delete":
      return chores.filter((chore) => chore.id !== action.id);
  }
}

export function ChoreList({
  chores,
  members,
  currentMemberId,
}: {
  chores: Item[];
  members: Person[];
  currentMemberId: string;
}) {
  const t = useTranslations("Chores");
  const tErrors = useTranslations("Errors");
  const [optimistic, apply] = useOptimistic(chores, reduce);
  const [mineOnly, setMineOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (action: OptimisticAction, call: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null);
      apply(action);
      try {
        const result = await call();
        if (!result.ok) setError(tErrors(result.error));
      } catch {
        setError(tErrors("generic"));
      }
    });

  const handleAdd = (input: ChoreInput) => {
    const draft: Item = {
      id: `draft-${crypto.randomUUID()}`,
      roundId: "",
      name: input.title,
      quantity: null,
      unit: null,
      category: "other",
      assigneeId: input.assigneeId,
      done: false,
      doneBy: null,
      doneAt: null,
      addedBy: currentMemberId,
      createdAt: new Date(),
    };
    run({ type: "add", chore: draft }, () => addChore(input));
  };

  const handlers = {
    members,
    onToggle: (id: string, done: boolean) => run({ type: "done", id, done }, () => setItemDone(id, done)),
    onUpdate: (id: string, input: ChoreInput) =>
      run({ type: "update", id, input }, () => updateChore(id, input)),
    onDelete: (id: string) => run({ type: "delete", id }, () => deleteItem(id)),
  };

  const visible = mineOnly ? optimistic.filter((c) => c.assigneeId === currentMemberId) : optimistic;
  const open = visible.filter((chore) => !chore.done);
  const done = visible.filter((chore) => chore.done);

  return (
    <div className="flex flex-col gap-6">
      <AddChoreForm members={members} defaultAssigneeId={currentMemberId} onAdd={handleAdd} />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-1" role="group">
        <Button size="sm" variant={mineOnly ? "ghost" : "secondary"} onClick={() => setMineOnly(false)} aria-pressed={!mineOnly}>
          {t("all")}
        </Button>
        <Button size="sm" variant={mineOnly ? "secondary" : "ghost"} onClick={() => setMineOnly(true)} aria-pressed={mineOnly}>
          {t("mine")}
        </Button>
      </div>

      {open.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {open.map((chore) => (
            <ChoreRow key={chore.id} chore={chore} {...handlers} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-muted-foreground">{t("done", { count: done.length })}</h2>
          <ul className="flex flex-col">
            {done.map((chore) => (
              <ChoreRow key={chore.id} chore={chore} {...handlers} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AddChoreForm({
  members,
  defaultAssigneeId,
  onAdd,
}: {
  members: Person[];
  defaultAssigneeId: string;
  onAdd: (input: ChoreInput) => void;
}) {
  const t = useTranslations("Chores");
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>(defaultAssigneeId);
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd({ title: title.trim(), assigneeId: assigneeId || null });
        setTitle("");
        titleRef.current?.focus();
      }}
    >
      <div className="flex gap-2">
        <Input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("addPlaceholder")}
          aria-label={t("titleLabel")}
          maxLength={200}
          className="h-10 flex-1 text-base"
        />
        <Button type="submit" size="lg" className="h-10" disabled={!title.trim()}>
          <PlusIcon />
          {t("add")}
        </Button>
      </div>
      <AssigneeSelect members={members} value={assigneeId} onChange={setAssigneeId} />
    </form>
  );
}

function AssigneeSelect({
  members,
  value,
  onChange,
  id,
}: {
  members: Person[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const t = useTranslations("Chores");
  return (
    <NativeSelect id={id} className="w-full" value={value} onChange={(e) => onChange(e.target.value)} aria-label={t("assignee")}>
      <NativeSelectOption value="">{t("unassigned")}</NativeSelectOption>
      {members.map((member) => (
        <NativeSelectOption key={member.id} value={member.id}>
          {member.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function ChoreRow({
  chore,
  members,
  onToggle,
  onUpdate,
  onDelete,
}: {
  chore: Item;
  members: Person[];
  onToggle: (id: string, done: boolean) => void;
  onUpdate: (id: string, input: ChoreInput) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("Chores");
  const [editing, setEditing] = useState(false);
  const isDraft = chore.id.startsWith("draft-");
  const assignee = members.find((m) => m.id === chore.assigneeId)?.name;

  return (
    <li className="flex min-h-11 items-center gap-3 border-b last:border-b-0">
      <Checkbox
        checked={chore.done}
        disabled={isDraft}
        onCheckedChange={(checked) => onToggle(chore.id, checked === true)}
        aria-label={chore.name}
        className="size-5"
      />
      <button
        type="button"
        disabled={isDraft}
        onClick={() => setEditing(true)}
        className={cn(
          "flex flex-1 items-baseline justify-between gap-2 py-2.5 text-start",
          chore.done && "text-muted-foreground line-through",
          isDraft && "opacity-60",
        )}
      >
        <span className="text-base">{chore.name}</span>
        <span className="shrink-0 text-sm text-muted-foreground">{assignee ?? t("unassigned")}</span>
      </button>
      {editing && (
        <EditChoreDialog
          chore={chore}
          members={members}
          onClose={() => setEditing(false)}
          onSave={(input) => onUpdate(chore.id, input)}
          onDelete={() => onDelete(chore.id)}
        />
      )}
    </li>
  );
}

function EditChoreDialog({
  chore,
  members,
  onClose,
  onSave,
  onDelete,
}: {
  chore: Item;
  members: Person[];
  onClose: () => void;
  onSave: (input: ChoreInput) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("Chores");
  const id = useId();
  const [title, setTitle] = useState(chore.name);
  const [assigneeId, setAssigneeId] = useState(chore.assigneeId ?? "");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onSave({ title: title.trim(), assigneeId: assigneeId || null });
            onClose();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-title`}>{t("titleLabel")}</Label>
            <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-assignee`}>{t("assignee")}</Label>
            <AssigneeSelect id={`${id}-assignee`} members={members} value={assigneeId} onChange={setAssigneeId} />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              {t("delete")}
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
