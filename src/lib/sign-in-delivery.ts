import "server-only";

/**
 * Delivers a sign-in code to a phone.
 *
 * The delivery channel (SMS provider or the WhatsApp bot) is still an open
 * question in docs/spec.md. Until it is chosen, codes are printed to the
 * server log in development, and production refuses to send.
 */
export async function sendSignInCode(phone: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[sign-in] code for ${phone}: ${code}`);
    return;
  }
  throw new Error("Sign-in code delivery is not configured");
}
