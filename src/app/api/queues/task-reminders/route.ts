import { handleCallback } from "@vercel/queue";
import { remindTask } from "@/lib/task-emails";

// Vercel Queues calls this at the time a reminder was scheduled for (see
// scheduleReminders). The task is checked again here, so a task that moved,
// was done, or was reassigned meanwhile gets no stale reminder. Wired to the
// "task-reminders" topic in vercel.json.
export const POST = handleCallback<{ itemId: string }>(
  async (message) => {
    if (typeof message?.itemId !== "string") return;
    await remindTask(message.itemId);
  },
  {
    // Sending is claimed in the database first, so a retry never sends twice.
    retry: (_error, metadata) => (metadata.deliveryCount > 5 ? { acknowledge: true } : { afterSeconds: 30 }),
  },
);
