import { cn } from "@/lib/utils";

/** How far along a list is: a short line of text and a thin bar, on one row. */
export function ListProgress({
  done,
  total,
  label,
  bar,
}: {
  done: number;
  total: number;
  label: string;
  /** The bar's color class. */
  bar: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{label}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-track-soft">
        <span
          className={cn("block h-full rounded-full transition-[width]", bar)}
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </span>
    </div>
  );
}
