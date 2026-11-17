import { get } from "@vercel/blob";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isInlineType } from "@/lib/attachment-rules";
import { findFileFor } from "@/lib/attachments";

/** Streams a private file to someone who can see its list. */
export async function GET(_request: Request, { params }: RouteContext<"/api/attachments/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });

  const file = await findFileFor(user.id, id);
  if (!file) return new Response(null, { status: 404 });
  const blob = await get(file.pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return new Response(null, { status: 404 });

  const type = file.contentType ?? "application/octet-stream";
  const disposition = isInlineType(file.contentType) ? "inline" : "attachment";
  return new Response(blob.stream, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Never let an uploaded file run as part of the app. Chrome won't show
      // a PDF under a sandbox; PDFs and images can't run scripts on this origin.
      ...(type === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'" }),
    },
  });
}
