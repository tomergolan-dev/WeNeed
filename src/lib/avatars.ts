import { Bike, Cat, Coffee, Dog, Flower2, Leaf, Music, Rocket, Smile, Star, Sun, Zap, type LucideIcon } from "lucide-react";

/** Icons the user can choose for their badge; the key is stored in users.avatar as "icon:<key>". */
export const AVATAR_ICONS = {
  smile: { icon: Smile, tone: "bg-tone-green text-tone-green-ink" },
  sun: { icon: Sun, tone: "bg-tone-amber text-tone-amber-ink" },
  star: { icon: Star, tone: "bg-warning-soft text-warning" },
  flower: { icon: Flower2, tone: "bg-tone-pink text-tone-pink-ink" },
  leaf: { icon: Leaf, tone: "bg-tone-olive text-tone-olive-ink" },
  cat: { icon: Cat, tone: "bg-tone-purple text-tone-purple-ink" },
  dog: { icon: Dog, tone: "bg-tone-brown text-tone-brown-ink" },
  coffee: { icon: Coffee, tone: "bg-tone-coffee text-tone-coffee-ink" },
  music: { icon: Music, tone: "bg-tone-blue text-tone-blue-ink" },
  bike: { icon: Bike, tone: "bg-tone-teal text-tone-teal-ink" },
  rocket: { icon: Rocket, tone: "bg-tone-rose text-tone-rose-ink" },
  zap: { icon: Zap, tone: "bg-tone-yellow text-tone-yellow-ink" },
} satisfies Record<string, { icon: LucideIcon; tone: string }>;

export type AvatarIcon = keyof typeof AVATAR_ICONS;
export const AVATAR_ICON_KEYS = Object.keys(AVATAR_ICONS) as AvatarIcon[];

export function isAvatarIcon(value: string): value is AvatarIcon {
  return value in AVATAR_ICONS;
}

/** What a stored users.avatar value means. */
export function parseAvatar(value: string | null | undefined):
  | { kind: "letter" }
  | { kind: "icon"; key: AvatarIcon }
  | { kind: "photo"; pathname: string } {
  if (value?.startsWith("icon:") && isAvatarIcon(value.slice(5))) return { kind: "icon", key: value.slice(5) as AvatarIcon };
  if (value?.startsWith("photo:")) return { kind: "photo", pathname: value.slice(6) };
  return { kind: "letter" };
}

/** Stored when the user picks the letter, so a Google photo is never brought in over their choice. */
export const LETTER = "letter";

/** Uploaded photos are made small in the browser first: a square this many pixels wide, as JPEG. */
export const AVATAR_PX = 256;
/** The most a resized photo may weigh when it reaches the server. */
export const MAX_AVATAR_BYTES = 200 * 1024;

/** Where a user's photo is served; the stored name changes with each photo, so it can be cached. */
export const avatarPhotoUrl = (pathname: string) => `/api/avatar?v=${encodeURIComponent(pathname.split("/").pop() ?? "")}`;
