import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import { Resend } from "resend";
import { directionOf } from "@/i18n/routing";

// Inline styles only: email clients ignore stylesheets. Colors follow the app theme.
// The email is in the language of the page the code was asked for.
async function renderHtml(code: string): Promise<string> {
  const locale = await getLocale();
  const t = await getTranslations("SignInEmail");
  return `<!doctype html><html lang="${locale}" dir="${directionOf(locale)}"><body style="margin:0;background:#fafbfa;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#1d2522">
<div style="max-width:440px;margin:0 auto;padding:32px 24px;text-align:center">
<p dir="ltr" style="margin:0 0 24px;font-size:16px;font-weight:800;color:#16835f">WeNeed</p>
<h1 style="margin:0 0 12px;font-size:20px">${t("heading")}</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#66736e">${t("body")}</p>
<p dir="ltr" style="margin:0 0 24px;padding:16px;border-radius:16px;background:#e4f3ec;color:#11684b;font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
<p style="margin:0;font-size:12px;color:#8a958f">${t("footer")}</p>
</div></body></html>`;
}

/**
 * Emails a sign-in code through Resend. Without RESEND_API_KEY in
 * development, the code is printed to the server log instead.
 */
export async function sendSignInCode(email: string, code: string): Promise<void> {
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

  const t = await getTranslations("SignInEmail");
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email,
    subject: t("subject", { code }),
    html: await renderHtml(code),
    text: `${t("heading")}: ${code}\n\n${t("body")}\n\n${t("footer")}`,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
