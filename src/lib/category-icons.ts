import {
  Apple,
  Baby,
  Beef,
  Candy,
  CupSoda,
  Croissant,
  Package,
  Snowflake,
  SoapDispenserDroplet,
  Soup,
  Sparkles,
  Milk,
  Wheat,
  Ham,
  Lamp,
  Flame,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "./categories";

const green = "bg-tone-olive text-tone-olive-ink";
const blue = "bg-tone-blue text-tone-blue-ink";
const amber = "bg-tone-amber text-tone-amber-ink";
const violet = "bg-tone-purple text-tone-purple-ink";
const rose = "bg-tone-rose text-tone-rose-ink";
const teal = "bg-tone-green text-tone-green-ink";

/** An icon and a soft tone for each store section's heading. */
export const CATEGORY_ICONS: Record<Category, { icon: LucideIcon; tone: string }> = {
  produce: { icon: Apple, tone: green },
  bakery: { icon: Croissant, tone: amber },
  dairy: { icon: Milk, tone: blue },
  meat_fish: { icon: Beef, tone: rose },
  deli: { icon: Ham, tone: rose },
  pantry: { icon: Wheat, tone: amber },
  canned: { icon: Soup, tone: amber },
  spices: { icon: Flame, tone: rose },
  snacks: { icon: Candy, tone: violet },
  drinks: { icon: CupSoda, tone: blue },
  frozen: { icon: Snowflake, tone: blue },
  cleaning: { icon: Sparkles, tone: teal },
  personal_care: { icon: SoapDispenserDroplet, tone: violet },
  baby: { icon: Baby, tone: violet },
  home: { icon: Lamp, tone: teal },
  other: { icon: Package, tone: teal },
};

/** Tones for people's initials, picked by their position in the place. */
export const TONES = [teal, rose, blue, amber, violet, green];
