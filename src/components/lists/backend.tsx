"use client";

import { createContext, useContext } from "react";
import { upload } from "@vercel/blob/client";
import {
  addChore,
  addItem,
  createList,
  deleteItem,
  deleteList,
  finishRound,
  renameList,
  reorderItems,
  setAllDone,
  setItemDone,
  setListType,
  updateChore,
  updateItem,
} from "@/app/actions";
import { askAssistant, removeAdded, setItemQuantity } from "@/app/assistant-actions";
import {
  addFile,
  addLink,
  deleteAttachment,
  getItemDetails,
  setItemNote,
  type AttachmentError,
} from "@/app/attachment-actions";
import { itemFolder } from "@/lib/attachment-rules";
import type { AttachmentView } from "@/lib/attachments";

type UploadResult = { ok: true; attachment: AttachmentView } | { ok: false; error: AttachmentError };

/**
 * Everything the list screens do to their data. The app uses the server
 * actions; the demo swaps in a store that lives in the visitor's browser
 * (see src/components/demo/), so the same screens serve both.
 */
export type Backend = {
  /** Prefix for links inside the app: "" in the app, "/demo" in the demo. */
  base: string;
  /** Whether a list's finished shopping trips can be browsed. */
  history: boolean;
  addItem: typeof addItem;
  updateItem: typeof updateItem;
  deleteItem: typeof deleteItem;
  setItemDone: typeof setItemDone;
  setAllDone: typeof setAllDone;
  reorderItems: typeof reorderItems;
  addChore: typeof addChore;
  updateChore: typeof updateChore;
  finishRound: typeof finishRound;
  createList: typeof createList;
  renameList: typeof renameList;
  setListType: typeof setListType;
  deleteList: typeof deleteList;
  askAssistant: typeof askAssistant;
  setItemQuantity: typeof setItemQuantity;
  removeAdded: typeof removeAdded;
  getItemDetails: typeof getItemDetails;
  setItemNote: typeof setItemNote;
  addLink: typeof addLink;
  deleteAttachment: typeof deleteAttachment;
  uploadFile: (itemId: string, file: File) => Promise<UploadResult>;
  /** Where a file attachment opens. */
  fileUrl: (attachment: AttachmentView) => string;
};

/** Uploads straight from the browser to private Blob storage, then records it. */
async function uploadToBlob(itemId: string, file: File): Promise<UploadResult> {
  const dot = file.name.lastIndexOf(".");
  const extension =
    dot > 0
      ? file.name
          .slice(dot)
          .toLowerCase()
          .replace(/[^.a-z0-9]/g, "")
      : "";
  const blob = await upload(`${itemFolder(itemId)}file${extension}`, file, {
    access: "private",
    handleUploadUrl: "/api/attachments/upload",
    clientPayload: itemId,
    contentType: file.type,
    multipart: file.size > 5 * 1024 * 1024,
  });
  return addFile(itemId, blob.pathname, file.name);
}

const serverBackend: Backend = {
  base: "",
  history: true,
  addItem,
  updateItem,
  deleteItem,
  setItemDone,
  setAllDone,
  reorderItems,
  addChore,
  updateChore,
  finishRound,
  createList,
  renameList,
  setListType,
  deleteList,
  askAssistant,
  setItemQuantity,
  removeAdded,
  getItemDetails,
  setItemNote,
  addLink,
  deleteAttachment,
  uploadFile: uploadToBlob,
  fileUrl: (attachment) => `/api/attachments/${attachment.id}`,
};

const BackendContext = createContext<Backend>(serverBackend);

export const BackendProvider = BackendContext.Provider;

export function useBackend() {
  return useContext(BackendContext);
}
