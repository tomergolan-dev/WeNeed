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
  intent: z.enum(["add_items", "show_list", "login_link", "other"]),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      category: z.enum(CATEGORIES),
    }),
  ),
});
export type ParsedMessage = z.infer<typeof ParsedMessage>;

// Kept stable (no per-request values) so it can be cached once it grows.
const SYSTEM_PROMPT = `You read WhatsApp messages sent to "We Need", a shared household shopping list bot. Messages are usually in Hebrew, sometimes in English or mixed.

Classify the message into exactly one intent:
- add_items: the sender needs things bought, e.g. "צריך חלב", "נגמר השמן", "need 2 cartons of milk and eggs", or just a bare product or list of products with no verb at all, e.g. "חבילת ביצים 18x", "במבה", "קולה x6".
  When a message names a product, it is add_items, even if it is short or has no verb.
- show_list: the sender asks what is on the list, e.g. "מה ברשימה?", "מה צריך לקנות?".
- login_link: the sender asks for a link to the list or to log in, e.g. "שלח לי קישור", "לינק".
- other: anything else (greetings, thanks, questions, unclear text).

For add_items, extract every product as a separate item:
- name: the product only, in the sender's language, in its natural base form, without quantity or unit words ("2 קרטוני חלב" -> name "חלב"). Keep a brand or variety when given ("חלב 3%", "קוטג' תנובה").
- quantity: a number only when the sender states how many to buy, otherwise null. Hebrew number words count ("שני", "שלושה", "חצי").
- Pack sizes describe the product, not how many to buy: "18x", "x6", "של 12", "שישייה", "מארז 4". Keep the size in the name in parentheses and leave quantity null unless a count of packs is also given: "חבילת ביצים 18x" -> name "ביצים (18)", quantity null; "2 שישיות מים" -> name "מים (שישייה)", quantity 2. Packaging words alone ("חבילת", "תבנית", "בקבוק") are not part of the name.
- unit: the unit as the sender wrote it, in Hebrew if the message is in Hebrew ("קרטונים", "ק״ג", "בקבוקים"), otherwise null. Never put a unit when the sender gave none.
- category: the supermarket section the product is found in. Sections: produce (fruit, vegetables, fresh herbs), bakery (bread, pita, cakes), dairy (milk, cheese, yogurt, eggs, butter), meat_fish (fresh and packaged meat, chicken, fish), deli (cold cuts, salads, hummus), pantry (rice, pasta, flour, sugar, cooking oil and olive oil, coffee, tea, cereal), canned (canned and jarred food), spices (spices, sauces, condiments, vinegar; not oils), snacks (snacks, sweets, chocolate), drinks (water, juice, soda, wine, beer), frozen, cleaning (cleaning supplies, dish soap, laundry, trash bags), personal_care (shampoo, soap, toothpaste, toilet paper, tissues), baby (diapers, wipes, formula), home (light bulbs, batteries, kitchen tools), other (only when nothing else fits).

If the sender names something already on the current list, still return it; duplicates are handled elsewhere.
For any intent other than add_items, return an empty items array.`;

export async function parseMessage(text: string, currentItems: string[]): Promise<ParsedMessage | null> {
  const context = currentItems.length
    ? `Current list: ${currentItems.join(", ")}`
    : "The current list is empty.";

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
