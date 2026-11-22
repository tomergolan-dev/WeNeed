import { buildCalendar, calendarOwner } from "@/lib/calendar";

// A user's calendar feed: /api/calendar/<token>.ics. Calendar apps fetch it
// without a session, so the token in the link is what lets them in.
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const owner = await calendarOwner(file.replace(/\.ics$/, ""));
  if (!owner) return new Response("Not found", { status: 404 });

  return new Response(await buildCalendar(owner), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="we-need.ics"',
      "Cache-Control": "private, no-store",
      // The link is private: keep it out of search engines.
      "X-Robots-Tag": "noindex",
    },
  });
}
