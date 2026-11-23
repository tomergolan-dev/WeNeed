"use client";

import { useTranslations } from "next-intl";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Item } from "@/db/schema";
import { cn } from "@/lib/utils";

/** The checklist in reorder mode: rows are dragged by their handle. */
export function SortableItems({ items, onReorder }: { items: Item[]; onReorder: (ids: string[]) => void }) {
  const t = useTranslations("Checklist");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((item) => item.id);
  const nameOf = (id: string | number) => items.find((item) => item.id === id)?.name ?? "";
  const placeOf = (id: string | number | undefined) => ids.indexOf(String(id)) + 1;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t("dragInstructions") },
        announcements: {
          onDragStart: ({ active }) => t("dragStart", { name: nameOf(active.id) }),
          onDragOver: ({ active, over }) => t("dragOver", { name: nameOf(active.id), place: placeOf(over?.id) }),
          onDragEnd: ({ active, over }) => t("dragEnd", { name: nameOf(active.id), place: placeOf(over?.id) }),
          onDragCancel: () => t("dragCancel"),
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="rounded-[18px] border bg-card shadow-soft">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ item }: { item: Item }) {
  const t = useTranslations("Checklist");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative flex min-h-[50px] items-center gap-3 border-b border-[#f0f2f1] bg-card px-3.5 last:border-b-0",
        isDragging && "z-10 rounded-[14px] shadow-lg",
      )}
    >
      <span
        className={cn("min-w-0 flex-1 truncate py-3 text-[15px]", item.done && "text-muted-foreground")}
      >
        {item.name}
      </span>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t("dragHandle", { name: item.name })}
        className="-me-2 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted-foreground active:cursor-grabbing active:bg-muted"
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
    </li>
  );
}
