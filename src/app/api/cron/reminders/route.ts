import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/task-emails";

// Called every 10 minutes by .github/workflows/task-reminders.yml (Vercel's
// Hobby plan runs its own cron jobs only once a day), with the shared
// CRON_SECRET as a bearer token.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results = await sendDueReminders();
  return Response.json(results);
}
