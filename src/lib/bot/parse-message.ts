// PAUSED (2026-11-16): part of the WhatsApp bot, which is no longer the main
// product (see "History" in docs/spec.md).
// Kept because its prompt and rules are the starting point for
// the AI chat (Stage G), tested by `npm run eval:parser`.
// Not used by the web app.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";

// Haiku handles this extraction as well as Opus at a fraction of the cost
// (checked against sample messages when switching).
const MODEL = "claude-haiku-5-5";

const client = new Anthropic();

const ParsedMessage = z.object({
  intent: z.enum(["add_items", "show_list", "show_chores", "login_link", "other"]),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      category: z.enum(CATEGORIES),
      // Name of the current-list item that is the same product, or null.
      existing: z.string().nullable(),
    }),
  ),
  // True when the message can be read either as a chore or as shopping.
  ambiguous: z.boolean(),
  chores: z.array(
    z.object({
      title: z.string(),
      // A household member's name copied from the member list, or null.
      assignee: z.string().nullable(),
    }),
  ),
});
export type ParsedMessage = z.infer<typeof ParsedMessage>;

// Kept stable (no per-request values) so it can be cached once it grows.
const SYSTEM_PROMPT = `You read WhatsApp messages sent to "We Need", a shared household shopping list bot. Messages are usually in Hebrew, sometimes in English or mixed.

Classify the message into exactly one intent:
- add_items: the sender needs things bought or done (shopping items and/or chores), e.g. "צריך חלב", "נגמר השמן", "need 2 cartons of milk and eggs", or just a bare product or list of products with no verb at all, e.g. "חבילת ביצים x18", "במבה", "קולה x6".
  When a message names a product, it is add_items, even if it is short or has no verb.
- show_list: the sender asks what is on the shopping list, e.g. "מה ברשימה?", "מה צריך לקנות?".
- show_chores: the sender asks about chores, e.g. "מה המטלות?", "מה אני צריך לעשות?", "מה יש לנורית לעשות?".
- login_link: the sender asks for a link to the list or to log in, e.g. "שלח לי קישור", "לינק".
- other: anything else (greetings, thanks, questions, unclear text).

For add_items, extract every product as a separate item. Products are separated by commas, "ו", or new lines; words like "שימורים", "קפוא", "טרי", "מגולענים" describe the same product ("זיתים מגולענים שימורים" is one item with that full name).
- name: the product only, without quantity, unit or packaging words ("2 קרטוני חלב" -> name "חלב"). Copy the product words exactly as the sender wrote them: never fix spelling, never expand slang or abbreviations, never translate ("גבנצ 15%" stays "גבנצ 15%", "יוגורטים מולר פרוטאין עם פקאן" stays as is). Keep a brand or variety when given ("חלב 3%", "קוטג' תנובה").
- quantity: the number to buy when the sender states one, otherwise null. Hebrew number words count ("שני", "שלושה", "חצי"). A number written with x or × ("x18", "18x", "×6") is a count of units: "חבילת ביצים x18" -> name "ביצים", quantity 18, unit null; "14 מעדני שוקולד" -> name "מעדני שוקולד", quantity 14, unit null. Packaging words without a count ("חבילת", "תבנית") are dropped.
- unit: the unit as the sender wrote it, in Hebrew if the message is in Hebrew ("קרטונים", "ק״ג", "בקבוקים", "חבילות", "שישיות"), otherwise null. Never put a unit when the sender gave none; a plain count of items has unit null ("2 שישיות מים" -> name "מים", quantity 2, unit "שישיות").
- category: the supermarket section the product is found in. Sections: produce (fruit, vegetables, fresh herbs), bakery (bread, pita, cakes), dairy (milk, cheese incl. white cheese "גבינה לבנה" a.k.a. "גבנצ", cottage, yogurt, puddings, eggs, butter), meat_fish (fresh and packaged meat, chicken, fish), deli (cold cuts, salads, hummus), pantry (rice, pasta, flour, sugar, cooking oil and olive oil, coffee, tea, cereal), canned (canned and jarred food), spices (spices, sauces, condiments, vinegar; not oils), snacks (snacks, sweets, chocolate), drinks (water, juice, soda, wine, beer), frozen, cleaning (cleaning supplies, dish soap, laundry, trash bags), personal_care (shampoo, soap, toothpaste, toilet paper, tissues), baby (diapers, wipes, formula), home (light bulbs, batteries, kitchen tools), other (only when nothing else fits).

- existing: if the current list already has the same product, its name copied exactly as it appears in the current list; otherwise null. Treat singular/plural, spelling variants and the same product in another language as the same ("עגבנייה" = "עגבניות"; English "milk" matches list item "חלב", "eggs" matches "ביצים"). Different products are not the same, even if related ("לחם" vs "לחמניות", "חלב" vs "חלב סויה").
Always return every requested item, including ones already on the list.

Chores are tasks to do rather than things to buy ("לתקן את הברז", "להוציא את הזבל", "לקבוע תור לרופא", "call the plumber"). Put them in chores, never in items; a message can have both:
- title: the whole task in infinitive form, without the person's name, keeping every detail the sender gave (what, when, where, how) in the sender's wording ("תומר צריך לתקן את הברז באמבטיה" -> "לתקן את הברז באמבטיה"; "אני צריך להכין למחר צהריים - חזה עוף בנינג'ה ולתוספת פתיתים" -> "להכין למחר צהריים - חזה עוף בנינג'ה ופתיתים"). One task stays one chore; do not split its details into separate chores or items.
- assignee: who should do it, copied exactly from the household members list. Only "אני", "עליי", "I" (the sender speaking about themselves) mean the sender. An impersonal "צריך ל..." / "need to ..." or a bare infinitive ("להכין ...", "לתקן ...") with no person named is unassigned: null. null also when the name is not in the list.
- Objects and ingredients mentioned inside a chore are not shopping items unless the sender also asks to buy them ("צריך להחליף נורה במטבח" -> one chore, no items).
- Going to a store to buy things is shopping, not a chore: "לעבור מחר בסופר לקנות בצל לבן" -> item "בצל לבן", no chores.
Return an empty chores array when there are none, and empty items and chores arrays for intents other than add_items.

ambiguous: true only when a task in the message involves products, so the sender might mean "do this" or "buy these" ("להכין חזה עוף ופתיתים לצהריים", "לבשל אורז עם שעועית"). Then return the task in chores AND the products the sender actually wrote in items ("חזה עוף", "פתיתים"). Never add ingredients or products the sender did not write: "להכין שקשוקה" and "לאפות עוגה" name no products, so they are plain chores, not ambiguous. Otherwise false:
- a bare product or product list is shopping, never ambiguous ("זיתים מגולענים שימורים", "מעדני שוקולד 12 יחידות");
- a task without products to buy is a chore, never ambiguous ("לתקן את הברז", "להחליף נורה במטבח", "לקבוע תור לרופא");
- a message with separate clear parts is not ambiguous ("צריך חלב ונורית צריכה להתקשר לאינסטלטור").
If the context says the sender chose a list, follow it: put everything in that list and set ambiguous false.`;

export type People = { sender: string; members: string[] };

export type Target = "chores" | "shopping";

export async function parseMessage(
  text: string,
  currentItems: string[],
  people: People,
  target: Target | null = null,
): Promise<ParsedMessage | null> {
  const context = [
    ...(target === "chores"
      ? ["The sender chose the chores list: everything in the message is chores, no items."]
      : target === "shopping"
        ? ["The sender chose the shopping list: everything in the message is items to buy, no chores."]
        : []),
    `Sender: ${people.sender}`,
    `Household members: ${people.members.join(", ")}`,
    currentItems.length ? `Current list: ${currentItems.join(", ")}` : "The current list is empty.",
  ].join("\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    // Simple extraction: low effort keeps it fast and cheap.
    output_config: { effort: "low", format: zodOutputFormat(ParsedMessage) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: context },
          { type: "text", text: `Message:\n${text}` },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    console.warn("[bot] unusable parse", response.stop_reason, response.stop_details);
    return null;
  }
  return response.parsed_output ?? null;
}
