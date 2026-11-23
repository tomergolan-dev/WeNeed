import { Bike, Cat, Coffee, Dog, Flower2, Leaf, Music, Rocket, Smile, Star, Sun, Zap, type LucideIcon } from "lucide-react";

/** Icons the user can choose for their badge; the key is stored in users.avatar as "icon:<key>". */
export const AVATAR_ICONS = {
  smile: { icon: Smile, tone: "bg-[#e4f3ec] text-[#11684b]" },
  sun: { icon: Sun, tone: "bg-[#faf1de] text-[#8f6814]" },
  star: { icon: Star, tone: "bg-[#fff3d6] text-[#8a5a00]" },
  flower: { icon: Flower2, tone: "bg-[#f9ecef] text-[#a14a64]" },
  leaf: { icon: Leaf, tone: "bg-[#eef4e8] text-[#557a3c]" },
  cat: { icon: Cat, tone: "bg-[#f0ecf7] text-[#6a5794]" },
  dog: { icon: Dog, tone: "bg-[#f3ece6] text-[#7a5a3f]" },
  coffee: { icon: Coffee, tone: "bg-[#efe9e4] text-[#6b4f3a]" },
  music: { icon: Music, tone: "bg-[#e8f1f7] text-[#3c6f8c]" },
  bike: { icon: Bike, tone: "bg-[#e6f4f4] text-[#2f7a78]" },
  rocket: { icon: Rocket, tone: "bg-[#f9ecea] text-[#9c4f47]" },
  zap: { icon: Zap, tone: "bg-[#fdf6d8] text-[#7d6a10]" },
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
