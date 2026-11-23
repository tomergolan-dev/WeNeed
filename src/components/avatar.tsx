import { User } from "lucide-react";
import { cn } from "@/lib/utils";

/** The user's round badge: the first letter of their name, or a person icon without one (the demo). */
export function Avatar({ name, className }: { name: string | null; className?: string }) {
  const initial = name ? Array.from(name.trim())[0] : undefined;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-[17px] font-semibold text-primary-foreground",
        className,
      )}
    >
      {initial ?? <User className="size-[45%]" />}
    </span>
  );
}
