import { Briefcase, Building2, House, Store, Tent, User, UtensilsCrossed, type LucideIcon } from "lucide-react";

/** Icons a place can have; the key is stored in places.icon. Each has a soft tone for its badge. */
export const PLACE_ICONS = {
  home: { icon: House, tone: "bg-tone-green text-tone-green-ink" },
  apartment: { icon: Building2, tone: "bg-tone-blue text-tone-blue-ink" },
  office: { icon: Briefcase, tone: "bg-tone-purple text-tone-purple-ink" },
  restaurant: { icon: UtensilsCrossed, tone: "bg-tone-rose text-tone-rose-ink" },
  store: { icon: Store, tone: "bg-tone-amber text-tone-amber-ink" },
  vacation: { icon: Tent, tone: "bg-tone-olive text-tone-olive-ink" },
} satisfies Record<string, { icon: LucideIcon; tone: string }>;

export type PlaceIcon = keyof typeof PLACE_ICONS;

export const PLACE_ICON_KEYS = Object.keys(PLACE_ICONS) as PlaceIcon[];

export function isPlaceIcon(value: string): value is PlaceIcon {
  return value in PLACE_ICONS;
}

/** The icon of a personal area ("שלי"); not offered when choosing a place's icon. */
export const PERSONAL_ICON = "personal";
const personal = { icon: User, tone: "bg-chip text-chip-ink" };

export function placeIcon(key: string) {
  if (key === PERSONAL_ICON) return personal;
  return isPlaceIcon(key) ? PLACE_ICONS[key] : PLACE_ICONS.home;
}
