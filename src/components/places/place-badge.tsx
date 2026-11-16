import { cn } from "cn";
import { placeIcon } from "@/lib/place-icons";

/** A place's icon in its round, softly tinted badge. */
export function PlaceBadge({ icon, className }: { icon: string; className?: string }) {
  const { icon: Icon, tone } = placeIcon(icon);
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone, className)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
