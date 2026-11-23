import { get } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { parseAvatar } from "@/lib/avatars";

/** Streams the signed-in user's own badge photo from the private Blob store. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const avatar = parseAvatar(user.avatar);
  if (avatar.kind !== "photo") return new Response(null, { status: 404 });
  const blob = await get(avatar.pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return new Response(null, { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "Content-Type": "image/jpeg",
      // The URL carries the photo's stored name, so a new photo is a new URL.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
