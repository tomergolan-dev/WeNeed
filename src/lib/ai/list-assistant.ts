// The AI chat in every list: reads a free-text message and returns what to add.
// The extraction rules come from the paused WhatsApp bot's parser
// (src/lib/bot/parse-message.ts), split by list kind.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORIES, type Category } from "@/lib/categories";

// Haiku handles this extraction as well as larger models, fast and at a
// fraction of the cost.
const MODEL = "claude-haiku-5-5";

const client = new Anthropic();

// Every example below is Hebrew, so without this rule the model sometimes
// translated English messages into Hebrew (seen in the English demo).
const LANGUAGE_RULE = `Language: keep what you return in the language the user wrote it in. An English message gives English names, units and titles ("we're out of olive oil and 2 cartons of milk" -> "olive oil"; "milk", 2, "cartons"), a Hebrew message gives Hebrew ones, and in a mixed message each word stays in its own language. Never translate, even though the examples below are in Hebrew.`;

const ITEM_RULES = `Extract every product as a separate item. Products are separated by commas, "ו", or new lines; words like "שימורים", "קפוא", "טרי", "מגולענים" describe the same product ("זיתים מגולענים שימורים" is one item with that full name).
- name: the product only, without quantity, unit or packaging words ("2 קרטוני חלב" -> name "חלב"). Copy the product words exactly as the user wrote them: never fix spelling, never expand slang or abbreviations, never translate ("גבנצ 15%" stays "גבנצ 15%"). Keep a brand or variety when given ("חלב 3%", "קוטג' תנובה").
- quantity: the number to buy when the user states one, otherwise null. Hebrew number words count ("שני", "שלושה", "חצי"). A number written with x or × ("x18", "18x", "×6") is a count of units: "חבילת ביצים x18" -> name "ביצים", quantity 18, unit null; "8 מעדני שוקולד" -> name "מעדני שוקולד", quantity 8, unit null. Packaging words without a count ("חבילת", "תבנית") are dropped.
- unit: the unit as the user wrote it, in the language of the message ("קרטונים", "ק״ג", "בקבוקים", "חבילות", "שישיות"; "cartons", "kg", "bottles", "packs"), otherwise null. Never put a unit when the user gave none; a plain count of items has unit null ("2 שישיות מים" -> name "מים", quantity 2, unit "שישיות").
- existing: if the current list already has the same product, its name copied exactly as it appears in the current list; otherwise null. The same product: singular/plural, spelling variants, the same product in another language, or a plain name for a listed item that only adds a brand, percentage or size ("עגבנייה" = "עגבניות"; "milk" = "חלב"; "חלב" = "חלב 3%"). Not the same: a different name for a related or similar product, even in the same family ("לחם" vs "לחמניות", "חלב" vs "חלב סויה", "גבינה לבנה" vs "גבנצ 15%", "יוגורט" vs "מעדן"). When unsure, null.
Always return every requested item, including ones already on the list. Words like "צריך", "תוסיף", "נגמר", "אין לנו" are not part of a name. Return an empty array when the message names nothing to add (a greeting, a question).`;

const CATEGORY_RULES = `category: the supermarket section the product is found in. Sections: produce (fruit, vegetables, fresh herbs), bakery (bread, pita, cakes), dairy (milk, cheese, white cheese such as "גבינה לבנה" and "גבנצ", cottage, yogurt, puddings, eggs, butter), meat_fish (fresh and packaged meat, chicken, fish), deli (cold cuts, salads, hummus), pantry (rice, pasta, flour, sugar, cooking oil and olive oil, coffee, tea, cereal), canned (canned and jarred food), spices (spices, sauces, condiments, vinegar; not oils), snacks (snacks, sweets, chocolate), drinks (water, juice, soda, wine, beer), frozen, cleaning (cleaning supplies, dish soap, laundry, trash bags), personal_care (shampoo, soap, toothpaste, toilet paper, tissues), baby (diapers, wipes, formula), home (light bulbs, batteries, kitchen tools), other (only when nothing else fits).`;

// Kept stable (no per-request values) so they can be cached once they grow.
const SHOPPING_PROMPT = `You read messages written in the AI chat of a shared shopping list in "We Need". Messages are usually in Hebrew, sometimes in English or mixed. Everything the user writes is something to buy.

${LANGUAGE_RULE}

${ITEM_RULES}
- ${CATEGORY_RULES}
A task that involves going to a store is still shopping: "לעבור מחר בסופר לקנות בצל לבן" -> item "בצל לבן".`;

const CHECKLIST_PROMPT = `You read messages written in the AI chat of a reusable checklist in "We Need" (for example "Weekend up north" or "Gym bag"). Messages are usually in Hebrew, sometimes in English or mixed. Everything the user writes is an item to have on the checklist.

${LANGUAGE_RULE}

${ITEM_RULES}
On a checklist, keep a quantity that matters inside the name as the user wrote it ("2 מגבות" -> name "2 מגבות").`;

const CHORES_PROMPT = `You read messages written in the AI chat of a shared chores list in "We Need". Messages are usually in Hebrew, sometimes in English or mixed. Everything the user writes is a chore to do; a message may hold several.

${LANGUAGE_RULE}

For each chore:
- title: the whole task as an action (in Hebrew, the infinitive; in English, the bare verb), without the person's name and without the date and time words, keeping every other detail in the user's wording ("תומר צריך לתקן את הברז באמבטיה מחר" -> "לתקן את הברז באמבטיה"; "Dan needs to fix the tap tomorrow" -> "Fix the tap"). One task stays one chore; do not split its details into separate chores.
- dueDate: the date the user gave, as YYYY-MM-DD, worked out from today's date in the context; otherwise null. "היום" is today, "מחר" tomorrow, "מחרתיים" the day after. A weekday ("ביום שישי", "עד שישי", "בשבת") is the nearest such day from today, today included only when it is that weekday and the user says "היום". "בשבוע הבא" without a day is null.
- dueTime: the time the user gave, as HH:MM (24 hours); otherwise null. A bare hour from 1 to 7 ("ב-5", "בחמש") means the afternoon or evening (17:00) unless the user says morning ("בבוקר"). "בערב" alone is 20:00, "בצהריים" alone 13:00, "בבוקר" alone 09:00. A time without a date is today, or tomorrow if that time has already passed today.
- assignee: who should do it, copied exactly from the members list. Only "אני", "עליי", "I" (the user speaking about themselves) mean the sender. An impersonal "צריך ל..." or a bare infinitive with no person named is null; null also when the name is not in the list.
Return an empty array when the message names nothing to do (a greeting, a question).`;

const ShoppingOutput = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      category: z.enum(CATEGORIES),
      existing: z.string().nullable(),
    }),
  ),
});

const ChecklistOutput = z.object({
  items: z.array(z.object({ name: z.string(), existing: z.string().nullable() })),
});

const ChoresOutput = z.object({
  chores: z.array(
    z.object({
      title: z.string(),
      dueDate: z.string().nullable(),
      dueTime: z.string().nullable(),
      assignee: z.string().nullable(),
    }),
  ),
});

export type ShoppingParse = z.infer<typeof ShoppingOutput>;
export type ChecklistParse = z.infer<typeof ChecklistOutput>;
export type ChoresParse = z.infer<typeof ChoresOutput>;

async function parse<T extends z.ZodType>(system: string, schema: T, context: string[], text: string) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    // Simple extraction: low effort keeps it fast and cheap.
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    system,
    messages: [
      {
        role: "user",
        content: [
          // The API rejects empty text blocks.
          ...(context.length ? [{ type: "text" as const, text: context.join("\n") }] : []),
          { type: "text", text: `Message:\n${text}` },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    console.warn("[ai] unusable parse", response.stop_reason);
    return null;
  }
  return (response.parsed_output as z.infer<T> | null) ?? null;
}

const listContext = (current: string[]) =>
  current.length ? `Current list: ${current.join(", ")}` : "The current list is empty.";

export function parseShopping(text: string, current: string[]) {
  return parse(SHOPPING_PROMPT, ShoppingOutput, [listContext(current)], text);
}

export function parseChecklist(text: string, current: string[]) {
  return parse(CHECKLIST_PROMPT, ChecklistOutput, [listContext(current)], text);
}

export function parseChores(
  text: string,
  people: { sender: string; members: string[] },
  now: { date: string; weekday: string; time: string },
) {
  return parse(
    CHORES_PROMPT,
    ChoresOutput,
    [
      `Today is ${now.weekday}, ${now.date}; the time is ${now.time} (Israel).`,
      `Sender: ${people.sender}`,
      `Members: ${people.members.join(", ")}`,
    ],
    text,
  );
}

const CategoryOutput = z.object({ category: z.enum(CATEGORIES) });

/** The store section of one product, for items added by hand. */
export async function guessCategoryWithAi(name: string): Promise<Category | null> {
  const result = await parse(
    `You sort grocery products into supermarket sections. Products are usually named in Hebrew.\n${CATEGORY_RULES}`,
    CategoryOutput,
    [],
    name,
  );
  return result?.category ?? null;
}
