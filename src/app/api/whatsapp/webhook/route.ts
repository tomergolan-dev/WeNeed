import { after, type NextRequest } from "next/server";
import { handleMessage } from "@/lib/bot/handle-message";
import { isValidVerifyToken, parseMessages, verifySignature } from "@/lib/whatsapp";

// Meta's one-time verification when the webhook URL is configured.
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && isValidVerifyToken(params.get("hub.verify_token"))) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Incoming messages. Answer 200 right away and process after the response,
// otherwise Meta retries and the user gets duplicate replies.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const messages = parseMessages(payload);
  after(async () => {
    for (const message of messages) {
      try {
        await handleMessage(message);
      } catch (error) {
        console.error("[whatsapp] failed to handle message", message.id, error);
      }
    }
  });

  return new Response("OK", { status: 200 });
}
