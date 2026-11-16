import "server-only";
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@/db";
import { members, processedMessages } from "@/db/schema";
import { locale } from "@/i18n/request";
import { createLoginToken, loginUrl } from "@/lib/login-tokens";
import { sendText, type IncomingMessage } from "@/lib/whatsapp";
import messages from "../../../messages/he.json";

const t = createTranslator({ locale, messages, namespace: "Bot" });

// Stage 2: recognize the sender, skip duplicates, reply "got it".
// Stage 3 replaces the default reply with Claude-based parsing.
export async function handleMessage(message: IncomingMessage): Promise<void> {
  // Meta may deliver the same message more than once.
  const [fresh] = await db
    .insert(processedMessages)
    .values({ waMessageId: message.id })
    .onConflictDoNothing()
    .returning();
  if (!fresh) return;

  const [member] = await db
    .select({ id: members.id, name: members.name })
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

  if (wantsLink(message.text)) {
    const token = await createLoginToken(member.id);
    await sendText(message.from, t("loginLink", { url: loginUrl(token) }));
    return;
  }

  await sendText(message.from, t("gotIt", { name: member.name }));
}

function wantsLink(text: string): boolean {
  return /קישור|לינק|link/i.test(text);
}
