import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// WhatsApp Cloud API (Meta). Docs: developers.facebook.com/docs/whatsapp/cloud-api
const GRAPH_VERSION = "v25.0";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Checks X-Hub-Signature-256 ("sha256=<hex>") against the raw request body. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", env("WHATSAPP_APP_SECRET")).update(rawBody).digest();
  const actual = Buffer.from(header.slice("sha256=".length), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isValidVerifyToken(token: string | null): boolean {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type IncomingMessage = {
  id: string;
  /** E.164, e.g. +972501234567 */
  from: string;
  type: string;
  /** Message text, or the title of a pressed reply button. */
  text: string | null;
  /** Id of a pressed reply button, if this message is a button press. */
  buttonId: string | null;
};

export type Button = { id: string; title: string };

type WebhookPayload = {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        messages?: {
          id: string;
          from: string;
          type: string;
          text?: { body?: string };
          interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
        }[];
      };
    }[];
  }[];
};

/** Extracts user messages; delivery/read status updates are ignored. */
export function parseMessages(payload: unknown): IncomingMessage[] {
  const entries = (payload as WebhookPayload)?.entry ?? [];
  return entries.flatMap((entry) =>
    (entry.changes ?? [])
      .filter((change) => change.field === "messages")
      .flatMap((change) => change.value?.messages ?? [])
      .filter((m) => typeof m?.id === "string" && typeof m?.from === "string")
      .map((m) => {
        const button = m.type === "interactive" ? m.interactive?.button_reply : undefined;
        return {
          id: m.id,
          from: `+${m.from.replace(/^\+/, "")}`,
          type: m.type,
          text: m.type === "text" ? (m.text?.body ?? null) : (button?.title ?? null),
          buttonId: button?.id ?? null,
        };
      }),
  );
}

/** Sends a plain text reply. Allowed within 24h of the user's last message. */
export async function sendText(to: string, body: string): Promise<void> {
  // No link preview card: it pushes the reply text down.
  await send(to, { type: "text", text: { body, preview_url: false } }, body);
}

/** Sends a message with up to 3 reply buttons (titles up to 20 characters). */
export async function sendButtons(to: string, body: string, buttons: Button[]): Promise<void> {
  await send(
    to,
    {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
        },
      },
    },
    `${body}\n${buttons.map((b) => `[${b.title}]`).join(" ")}`,
  );
}

async function send(to: string, message: Record<string, unknown>, preview: string): Promise<void> {
  // Local testing: log replies instead of sending real WhatsApp messages.
  if (process.env.WHATSAPP_DRY_RUN === "1") {
    console.log(`[whatsapp:dry-run] to ${to}:\n${preview}\n---`);
    return;
  }
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), ...message }),
    },
  );
  if (!res.ok) {
    throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
  }
}
