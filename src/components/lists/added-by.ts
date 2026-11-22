"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Item } from "@/db/schema";
import { useMe } from "./me";
import { isDraft } from "./use-list-items";

/**
 * The line under an item's edit title: who added it and when
 * ("נוסף ע״י תומר · 22 בנוב׳, 13:06"), or "נוסף על ידך" for what I added.
 * Without a known name, only when.
 * Tasks use their own wording, since "משימה" is feminine in Hebrew.
 */
export function useAddedBy(item: Item | null, people: { id: string; name: string }[], task = false) {
  const t = useTranslations(task ? "Chores" : "ItemForm");
  const format = useFormatter();
  const me = useMe();
  if (!item || isDraft(item)) return undefined;
  const added = new Date(item.createdAt);
  const date = format.dateTime(added, {
    day: "numeric",
    month: "short",
    ...(added.getFullYear() !== new Date().getFullYear() && {
      year: "numeric",
    }),
    hour: "2-digit",
    minute: "2-digit",
  });
  if (me && item.addedBy === me) return t("addedByMe", { date });
  const name = people.find((person) => person.id === item.addedBy)?.name;
  return name ? t("addedBy", { name: `⁨${name}⁩`, date }) : t("addedAt", { date });
}
