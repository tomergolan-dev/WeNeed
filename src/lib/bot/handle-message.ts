import "server-only";
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@/db";
import { items, members, processedMessages, type Item } from "@/db/schema";
import { locale } from "@/i18n/request";
import { isCategory } from "@/lib/categories";
import { formatQuantity, groupByCategory } from "@/lib/items";
import { ensureActiveList, getListItems } from "@/lib/lists";
import { createLoginToken, loginUrl } from "@/lib/login-tokens";
import { sendText, type IncomingMessage } from "@/lib/whatsapp";
import messages from "../../../messages/he.json";
import { parseMessage } from "./parse-message";

const t = createTranslator({ locale, messages, namespace: "Bot" });
const tCategories = createTranslator({ locale, messages, namespace: "Categories" });

type Member = { id: string; name: string; householdId: string };

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function handleMessage(message: IncomingMessage): Promise<void> {
  // Meta may deliver the same message more than once.
  const [fresh] = await db
    .insert(processedMessages)
    .values({ waMessageId: message.id })
    .onConflictDoNothing()
    .returning();
  if (!fresh) return;

  const [member] = await db
    .select({ id: members.id, name: members.name, householdId: members.householdId })
    .from(members)
    .where(eq(members.phone, message.from));

  if (!member) {
    await sendText(message.from, t("unknownSender"));
    return;
  }
  if (message.text === null) {
    await sendText(message.from, t("textOnly"));
    return;
  }

  await sendText(message.from, await reply(member, message.text));
}

async function reply(member: Member, text: string): Promise<string> {
  // Stage 4 adds the "no active list" question; until then a list opens silently.
  const list = await ensureActiveList(member.householdId, "shopping");
  const current = await getListItems(list.id);
  const open = current.filter((item) => !item.done);

  const parsed = await parseMessage(
    text,
    open.map((item) => item.name),
  );
  if (!parsed) return t("notUnderstood");

  switch (parsed.intent) {
    case "add_items": {
      if (parsed.items.length === 0) return t("notUnderstood");
      await db.insert(items).values(
        parsed.items.map((item) => ({
          listId: list.id,
          name: item.name.trim(),
          quantity: item.quantity && item.quantity > 0 ? item.quantity : null,
          unit: item.unit?.trim() || null,
          category: item.category,
          addedBy: member.id,
        })),
      );
      return t("added", { items: parsed.items.map(describe).join(", "), url: appUrl() });
    }
    case "show_list":
      return formatList(open);
    case "login_link": {
      const token = await createLoginToken(member.id);
      return t("loginLink", { url: loginUrl(token) });
    }
    case "other":
      return t("help", { name: member.name });
  }
}

function describe(item: { name: string; quantity: number | null; unit: string | null }): string {
  const quantity = formatQuantity(item);
  return quantity ? `${item.name} ${quantity}` : item.name;
}

function formatList(open: Item[]): string {
  if (open.length === 0) return t("listEmpty", { url: appUrl() });
  const sections = groupByCategory(open)
    .map(
      ({ category, items }) =>
        `*${tCategories(isCategory(category) ? category : "other")}*\n${items.map((item) => `• ${describe(item)}`).join("\n")}`,
    )
    .join("\n\n");
  return t("list", { sections, url: appUrl() });
}
