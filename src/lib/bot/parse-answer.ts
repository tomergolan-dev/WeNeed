import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Interprets a reply to a yes/no question the bot asked about a set of
// options, e.g. "carry over cheese, oil, toilet paper?" -> "just the cheese".

const MODEL = "claude-haiku-5-5";
const client = new Anthropic();

const Answer = z.object({
  answer: z.enum(["yes", "no", "some", "unrelated"]),
  // For "some": the chosen options, copied exactly from the option list.
  selected: z.array(z.string()),
});
export type Answer = z.infer<typeof Answer>;

const SYSTEM_PROMPT = `A household shopping list bot asked the user a yes/no question about a list of options (shopping items). Classify the user's reply:
- yes: agrees to all options ("כן", "בטח", "יאללה", "סבבה", "yes", 👍).
- no: declines all options ("לא", "לא צריך", "no", 👎).
- some: agrees only to some options ("רק הגבינה", "רק את החלב והשמן", "הכל חוץ מהשמן"). Put the chosen options in selected, copied exactly from the option list.
- unrelated: the reply is not an answer to the question (a new request, a new shopping item, another question).
Return an empty selected array unless the answer is some.`;

const YES = new Set(["כן", "כן כן", "בטח", "יאללה", "סבבה", "אוקיי", "ok", "okay", "yes", "y", "👍"]);
const NO = new Set(["לא", "לא לא", "לא צריך", "no", "n", "👎"]);

function quickAnswer(text: string): Answer | null {
  const normalized = text.trim().toLowerCase().replace(/[.!?,]+$/u, "");
  if (YES.has(normalized)) return { answer: "yes", selected: [] };
  if (NO.has(normalized)) return { answer: "no", selected: [] };
  return null;
}

export async function parseAnswer(text: string, options: string[]): Promise<Answer | null> {
  const quick = quickAnswer(text);
  if (quick) return quick;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(Answer) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Options: ${options.join(", ")}` },
          { type: "text", text: `Reply:\n${text}` },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    console.warn("[bot] unusable answer parse", response.stop_reason, response.stop_details);
    return null;
  }
  const parsed = response.parsed_output;
  if (!parsed) return null;
  // Keep only options that were actually offered.
  return { ...parsed, selected: parsed.selected.filter((s) => options.includes(s)) };
}
