import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/task-emails";

// The backup to the reminders queue (see sendDueReminders): called once a day
// by Vercel's cron (vercel.json; the Hobby plan allows no more), and as often
// as GitHub manages by .github/workflows/task-reminders.yml, which GitHub
// often skips. Both send the shared CRON_SECRET as a bearer token.
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
