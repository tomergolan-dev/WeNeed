// Shared by the upload route, the server actions and the file picker.

/** Files people may attach: photos, PDFs, Office documents and plain text. */
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ITEM = 20;

/** Shown inline in the browser; anything else is downloaded. */
export function isInlineType(contentType: string | null) {
  return contentType !== null && (contentType.startsWith("image/") || contentType === "application/pdf");
}

export function isImageType(contentType: string | null) {
  return contentType !== null && contentType.startsWith("image/") && contentType !== "image/heic" && contentType !== "image/heif";
}

/** Every file of an item is stored under this folder. */
export const itemFolder = (itemId: string) => `items/${itemId}/`;
