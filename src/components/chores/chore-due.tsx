"use client";

import { useFormatter, useTranslations } from "next-intl";
import { daysBetween, dueAt, todayIn, type DueStatus } from "@/lib/due";
import { cn } from "@/lib/utils";

type Dated = { dueDate: string | null; dueTime: string | null };

/** "היום, 17:00", "מחר", "יום ו׳, 21.11" or "21.11.2027". */
export function useDueText() {
  const t = useTranslations("Chores");
  const format = useFormatter();
  return ({ dueDate, dueTime }: Dated, now: number) => {
    if (!dueDate) return t("noDate");
    const days = daysBetween(todayIn(now), dueDate);
    const [y, m, d] = dueDate.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const day =
      days === -1
        ? t("yesterday")
        : days === 0
          ? t("today")
          : days === 1
            ? t("tomorrow")
            : days > 1 && days < 7
              ? format.dateTime(date, { weekday: "short", timeZone: "UTC" })
              : format.dateTime(date, {
                  day: "numeric",
                  month: "numeric",
                  ...(y !== Number(todayIn(now).slice(0, 4)) && { year: "numeric" }),
                  timeZone: "UTC",
                });
    return dueTime ? `${day}, ${dueTime.slice(0, 5)}` : day;
  };
}

/** The warning pill: "באיחור של יום", "בעוד 3 שעות", "בעוד 20 דקות", "היום". */
export function DuePill({ chore, status, now }: { chore: Dated; status: DueStatus; now: number }) {
  const t = useTranslations("Chores");
  if ((status !== "overdue" && status !== "soon") || !chore.dueDate) return null;

  let text: string;
  if (status === "overdue") {
    const days = daysBetween(chore.dueDate, todayIn(now));
    text = days >= 1 ? t("overdueDays", { count: days }) : t("overdue");
  } else if (chore.dueTime) {
    // Minutes under an hour ("בעוד 20 דקות"), otherwise the nearest whole hour.
    const left = dueAt(chore.dueDate, chore.dueTime) - now;
    text =
      left < 55 * 60_000
        ? t("inMinutes", { count: Math.max(1, Math.ceil(left / 60_000)) })
        : t("inHours", { count: Math.max(1, Math.round(left / 3_600_000)) });
  } else {
    text = daysBetween(todayIn(now), chore.dueDate) === 0 ? t("today") : t("tomorrow");
  }

  return (
    <span
      suppressHydrationWarning
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold",
        status === "overdue" ? "bg-[#fdecea] text-[#b42318]" : "bg-[#fff3d6] text-[#8a5a00]",
      )}
    >
      {text}
    </span>
  );
}
