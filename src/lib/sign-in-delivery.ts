import "server-only";
import { Resend } from "resend";

/**
 * Emails a sign-in code through Resend. Without RESEND_API_KEY in
 * development, the code is printed to the server log instead.
 */
export async function sendSignInCode(email: string, code: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[sign-in] code for ${email}: ${code}`);
      return;
    }
    throw new Error("RESEND_API_KEY is not set");
  }

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  const { error } = await new Resend(apiKey).emails.send({ from, to: email, subject, text });
  if (error) throw new Error(`Resend: ${error.message}`);
}
