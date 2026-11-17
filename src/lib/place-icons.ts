import { Briefcase, Building2, House, Store, Tent, User, UtensilsCrossed, type LucideIcon } from "lucide-react";

/** Icons a place can have; the key is stored in places.icon. Each has a soft tone for its badge. */
export const PLACE_ICONS = {
  home: { icon: House, tone: "bg-[#e4f3ec] text-[#11684b]" },
  apartment: { icon: Building2, tone: "bg-[#e8f1f7] text-[#3c6f8c]" },
  office: { icon: Briefcase, tone: "bg-[#f0ecf7] text-[#6a5794]" },
  restaurant: { icon: UtensilsCrossed, tone: "bg-[#f9ecea] text-[#9c4f47]" },
  store: { icon: Store, tone: "bg-[#faf1de] text-[#8f6814]" },
  vacation: { icon: Tent, tone: "bg-[#eef4e8] text-[#557a3c]" },
} satisfies Record<string, { icon: LucideIcon; tone: string }>;

export type PlaceIcon = keyof typeof PLACE_ICONS;

export const PLACE_ICON_KEYS = Object.keys(PLACE_ICONS) as PlaceIcon[];

export function isPlaceIcon(value: string): value is PlaceIcon {
  return value in PLACE_ICONS;
}

/** The icon of a personal area ("שלי"); not offered when choosing a place's icon. */
export const PERSONAL_ICON = "personal";
const personal = { icon: User, tone: "bg-[#eceff0] text-[#4c5853]" };

export function placeIcon(key: string) {
  if (key === PERSONAL_ICON) return personal;
  return isPlaceIcon(key) ? PLACE_ICONS[key] : PLACE_ICONS.home;
}
