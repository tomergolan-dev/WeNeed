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

const green = "bg-[#eef4e8] text-[#557a3c]";
const blue = "bg-[#e8f1f7] text-[#3c6f8c]";
const amber = "bg-[#faf1de] text-[#8f6814]";
const violet = "bg-[#f0ecf7] text-[#6a5794]";
const rose = "bg-[#f9ecea] text-[#9c4f47]";
const teal = "bg-[#e4f3ec] text-[#11684b]";

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
