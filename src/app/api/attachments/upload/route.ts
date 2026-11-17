import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES, itemFolder } from "@/lib/attachment-rules";
import { findEditableItem } from "@/lib/list-access";

/**
 * Hands the browser a short-lived token to upload one file straight to the
 * private Blob store, under the folder of an item the user can edit. The
 * browser then records the file with addFile (attachment-actions.ts).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser();
        if (!user || !clientPayload) throw new Error("unauthorized");
        const item = await findEditableItem(clientPayload, user.id);
        if (!item || item.status !== "active") throw new Error("notFound");
        if (!pathname.startsWith(itemFolder(item.id)) || pathname.includes("..")) throw new Error("invalid");
        return {
          allowedContentTypes: ALLOWED_FILE_TYPES,
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
