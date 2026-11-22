"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { ChoreInput } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export type ChoreDraft = { title: string; dueDate: string; dueTime: string; assigneeId: string };

export const emptyChore: ChoreDraft = { title: "", dueDate: "", dueTime: "", assigneeId: "" };

export function toChoreInput(draft: ChoreDraft): ChoreInput | null {
  const title = draft.title.trim();
  if (!title) return null;
  return {
    title,
    dueDate: draft.dueDate || null,
    dueTime: draft.dueDate && draft.dueTime ? draft.dueTime.slice(0, 5) : null,
    assigneeId: draft.assigneeId || null,
  };
}

// iOS draws date and time fields natively, wider than their column and with the
// value centered; this keeps them inside their half and aligned like other fields.
const dateTimeClass =
  "h-11 appearance-none bg-card px-3 text-start text-base [&::-webkit-date-and-time-value]:text-start [&::-webkit-date-and-time-value]:min-h-[1.5em]";

export function ChoreFields({
  draft,
  onChange,
  people,
}: {
  draft: ChoreDraft;
  onChange: (draft: ChoreDraft) => void;
  people: { id: string; name: string }[];
}) {
  const t = useTranslations("Chores");
  const id = useId();
  const set = (patch: Partial<ChoreDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor={`${id}-title`}>{t("titleLabel")}</Label>
        <Input
          id={`${id}-title`}
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          maxLength={200}
          required
          className="h-11 bg-card text-base"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-date`}>{t("date")}</Label>
        <Input
          id={`${id}-date`}
          type="date"
          value={draft.dueDate}
          onChange={(e) => set({ dueDate: e.target.value, dueTime: e.target.value ? draft.dueTime : "" })}
          className={dateTimeClass}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-time`}>{t("time")}</Label>
        <Input
          id={`${id}-time`}
          type="time"
          value={draft.dueTime}
          disabled={!draft.dueDate}
          onChange={(e) => set({ dueTime: e.target.value })}
          className={dateTimeClass}
        />
      </div>
      {/* A list only one person sees has no one else to assign: its tasks are theirs. */}
      {(people.length > 1 || draft.assigneeId !== "") && (
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor={`${id}-assignee`}>{t("assignee")}</Label>
          <NativeSelect
            id={`${id}-assignee`}
            className="w-full"
            value={draft.assigneeId}
            onChange={(e) => set({ assigneeId: e.target.value })}
          >
            <NativeSelectOption value="">{t("unassigned")}</NativeSelectOption>
            {people.map((person) => (
              <NativeSelectOption key={person.id} value={person.id}>
                {person.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  );
}
