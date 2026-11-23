import { User } from "lucide-react";
import { AVATAR_ICONS, avatarPhotoUrl, parseAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * The user's round badge: their photo, the icon they chose, or the first
 * letter of their name; a person icon without a name (the demo).
 */
export function Avatar({ name, avatar, className }: { name: string | null; avatar?: string | null; className?: string }) {
  const chosen = parseAvatar(avatar);
  const base = "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full";
  if (chosen.kind === "photo") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a private, already tiny photo behind a session
      <img src={avatarPhotoUrl(chosen.pathname)} alt="" aria-hidden className={cn(base, "bg-muted object-cover", className)} />
    );
  }
  if (chosen.kind === "icon") {
    const { icon: Icon, tone } = AVATAR_ICONS[chosen.key];
    return (
      <span aria-hidden className={cn(base, tone, className)}>
        <Icon className="size-[48%]" />
      </span>
    );
  }
  const initial = name ? Array.from(name.trim())[0] : undefined;
  return (
    <span aria-hidden className={cn(base, "bg-primary text-[17px] font-semibold text-primary-foreground", className)}>
      {initial ?? <User className="size-[45%]" />}
    </span>
  );
}
