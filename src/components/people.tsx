import { cn } from "cn";
import { TONES } from "@/lib/category-icons";

/** A stable soft tone for a person, so they keep their color across screens. */
export function personTone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

/** A person's initial in a round, tinted badge. */
export function Initial({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        personTone(name),
        className,
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/** Small overlapping initials, for "shared with". */
export function MiniInitials({ names }: { names: string[] }) {
  return (
    <span aria-hidden className="inline-flex">
      {names.slice(0, 3).map((name, i) => (
        <Initial
          key={`${name}-${i}`}
          name={name}
          className={cn("size-5 border-2 border-card text-[10px]", i > 0 && "-ms-1.5")}
        />
      ))}
    </span>
  );
}
