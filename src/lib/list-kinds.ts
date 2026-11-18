import { CalendarCheck, ListChecks, ShoppingCart, type LucideIcon } from "lucide-react";
import type { List } from "@/db/schema";

export type ListType = List["type"];

export const LIST_TYPES: ListType[] = ["shopping", "tasks", "checklist"];

/** Each kind's icon and soft tone. Hebrew names live under "ListKinds" in the messages. */
export const LIST_KINDS: Record<ListType, { icon: LucideIcon; tone: string }> = {
  shopping: { icon: ShoppingCart, tone: "bg-[#e4f3ec] text-[#11684b]" },
  tasks: { icon: CalendarCheck, tone: "bg-[#f0ecf7] text-[#6a5794]" },
  checklist: { icon: ListChecks, tone: "bg-[#faf1de] text-[#8f6814]" },
};

export function isListType(value: string): value is ListType {
  return (LIST_TYPES as string[]).includes(value);
}

// Words that hint at a kind, matched anywhere in the list's name.
const HINTS: [ListType, RegExp][] = [
  ["tasks", /מטל|משימ|לעשות|סידורים|תיקונ|ניקיון|לתקן|to ?do/iu],
  ["checklist", /ציוד|לארוז|אריזה|לקחת|טיול|סופ.?ש|חופשה|נסיעה|קמפינג|מחנאות|תיק|צ.?ק ?ליסט|checklist|ים\b|חתונה|לידה/iu],
  ["shopping", /קני|סופר|שוק|קצב|מכולת|ירקן|פארם|מאפייה|רשימת קניות/iu],
];

/** A best guess of the kind from the name; null when nothing hints at one. */
export function guessListType(name: string): ListType | null {
  for (const [type, pattern] of HINTS) if (pattern.test(name)) return type;
  return null;
}
