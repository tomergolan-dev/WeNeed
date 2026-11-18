"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import {
  Camera,
  ChevronLeft,
  ExternalLink,
  FileText,
  Link2,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  StickyNote,
  X,
} from "lucide-react";
import type { AttachmentError } from "@/app/attachment-actions";
import type { Item } from "@/db/schema";
import { BottomSheet } from "@/components/bottom-sheet";
import { useBackend } from "@/components/lists/backend";
import { Button } from "@/components/ui/button";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_BYTES,
  isImageType,
} from "@/lib/attachment-rules";
import type { AttachmentView } from "@/lib/attachments";
import { cn } from "@/lib/utils";

type Opened = { item: Item; onEdit?: () => void };
type Details = {
  open: (item: Item, onEdit?: () => void) => void;
  count: (itemId: string) => number;
};

const DetailsContext = createContext<Details | null>(null);

/** Gives a list's rows the paperclip and the item details sheet. */
export function ItemDetailsProvider({
  counts,
  children,
}: {
  counts: Record<string, number>;
  children: React.ReactNode;
}) {
  const [opened, setOpened] = useState<Opened | null>(null);
  return (
    <DetailsContext.Provider
      value={{
        open: (item, onEdit) => setOpened({ item, onEdit }),
        count: (id) => counts[id] ?? 0,
      }}
    >
      {children}
      {opened && (
        <DetailsSheet
          key={opened.item.id}
          {...opened}
          onClose={() => setOpened(null)}
        />
      )}
    </DetailsContext.Provider>
  );
}

function useDetails() {
  const context = useContext(DetailsContext);
  if (!context) throw new Error("useDetails needs ItemDetailsProvider");
  return context;
}

/** On a row: a paperclip with the number of attachments, or a note mark. Hidden when there is neither. */
export function ClipChip({
  item,
  onEdit,
}: {
  item: Item;
  onEdit?: () => void;
}) {
  const t = useTranslations("Attachments");
  const { open, count } = useDetails();
  const n = count(item.id);
  if (n === 0 && !item.note) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open(item, onEdit);
      }}
      aria-label={t("openFor", { name: item.name, count: n })}
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#eceff0] text-[#4c5853] active:bg-[#dfe3e1]"
    >
      {n > 0 ? <Paperclip className="size-3.5" aria-hidden /> : <StickyNote className="size-3.5" aria-hidden />}
    </button>
  );
}

/** In an item's edit sheet: opens its details instead. */
export function DetailsButton({
  item,
  onOpen,
  onEdit,
}: {
  item: Item;
  onOpen: () => void;
  onEdit?: () => void;
}) {
  const t = useTranslations("Attachments");
  const { open, count } = useDetails();
  const n = count(item.id);
  return (
    <button
      type="button"
      onClick={() => {
        onOpen();
        open(item, onEdit);
      }}
      className="flex h-13 w-full items-center gap-3 rounded-2xl border bg-card px-4 text-start font-semibold transition-colors active:bg-muted"
    >
      <Paperclip className="size-5 text-muted-foreground" aria-hidden />
      <span className="flex-1">{t("open")}</span>
      {n > 0 && (
        <span className="text-sm font-normal text-muted-foreground">
          {t("count", { count: n })}
        </span>
      )}
      <ChevronLeft
        className="size-4 text-muted-foreground ltr:-scale-x-100"
        aria-hidden
      />
    </button>
  );
}

const heading = "mb-2 px-0.5 text-[13px] font-semibold text-muted-foreground";

function DetailsSheet({
  item,
  onEdit,
  onClose,
}: Opened & { onClose: () => void }) {
  const t = useTranslations("Attachments");
  const tErrors = useTranslations("Errors");
  const { getItemDetails, setItemNote, addLink, deleteAttachment, uploadFile, fileUrl } = useBackend();
  const [loaded, setLoaded] = useState<{
    note: string;
    attachments: AttachmentView[];
    readOnly: boolean;
  } | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState<string[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showError = (code: AttachmentError) => setError(tErrors(code));

  useEffect(() => {
    let live = true;
    getItemDetails(item.id).then((result) => {
      if (!live) return;
      if (result.ok) {
        setLoaded({
          note: result.note,
          attachments: result.attachments,
          readOnly: result.readOnly,
        });
        setNote(result.note);
      } else setError(tErrors(result.error));
    });
    return () => {
      live = false;
    };
  }, [item.id, tErrors, getItemDetails]);

  const add = (attachment: AttachmentView) =>
    setLoaded(
      (current) =>
        current && {
          ...current,
          attachments: [...current.attachments, attachment],
        },
    );

  function saveNote() {
    if (!loaded || note.trim() === loaded.note.trim()) return;
    const value = note;
    setLoaded({ ...loaded, note: value });
    startTransition(async () => {
      const result = await setItemNote(item.id, value);
      if (!result.ok) showError(result.error);
    });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        showError("invalid");
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(t("tooBig"));
        continue;
      }
      const key = `${file.name}-${crypto.randomUUID()}`;
      setUploading((current) => [...current, key]);
      try {
        const result = await uploadFile(item.id, file);
        if (result.ok) add(result.attachment);
        else showError(result.error);
      } catch {
        showError("uploadFailed");
      } finally {
        setUploading((current) => current.filter((k) => k !== key));
      }
    }
  }

  function remove(attachment: AttachmentView) {
    setLoaded(
      (current) =>
        current && {
          ...current,
          attachments: current.attachments.filter(
            (a) => a.id !== attachment.id,
          ),
        },
    );
    startTransition(async () => {
      const result = await deleteAttachment(attachment.id);
      if (!result.ok) {
        showError(result.error);
        add(attachment);
      }
    });
  }

  const links = loaded?.attachments.filter((a) => a.kind === "link") ?? [];
  const files = loaded?.attachments.filter((a) => a.kind === "file") ?? [];
  const readOnly = loaded?.readOnly ?? true;

  return (
    <BottomSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={item.name}
    >
      <div className="-mt-1 flex max-h-[72dvh] flex-col overflow-y-auto pb-1">
        {onEdit && !readOnly && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="mb-3 flex h-10 items-center gap-1.5 self-start rounded-xl border bg-card px-3.5 text-sm font-semibold"
          >
            <Pencil className="size-4" aria-hidden />
            {t("edit")}
          </button>
        )}

        {!loaded ? (
          <div className="flex justify-center py-10">
            <LoaderCircle
              className="size-6 animate-spin text-primary"
              aria-label={t("loading")}
            />
          </div>
        ) : (
          <>
            <label htmlFor="item-note" className={heading}>
              {t("note")}
            </label>
            <textarea
              id="item-note"
              value={note}
              readOnly={readOnly}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              maxLength={2000}
              rows={2}
              placeholder={readOnly ? "" : t("notePlaceholder")}
              className="field-sizing-content min-h-12 w-full resize-none rounded-[18px] border bg-card px-3.5 py-3 text-[15px] leading-normal outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15"
            />

            {(links.length > 0 || linkOpen) && (
              <>
                <h3 className={cn(heading, "mt-4")}>{t("links")}</h3>
                <ul className="flex flex-col gap-2">
                  {links.map((link) => (
                    <li
                      key={link.id}
                      className="flex items-center gap-2.5 rounded-[14px] border bg-card py-2.5 ps-3 pe-1.5"
                    >
                      <span className="flex size-8.5 shrink-0 items-center justify-center rounded-full bg-[#e8f1f7] text-[#3c6f8c]">
                        <Link2 className="size-4" aria-hidden />
                      </span>
                      <a
                        href={link.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 flex-col"
                      >
                        <span className="truncate text-[15px] font-semibold">
                          {link.name}
                        </span>
                        <span
                          dir="ltr"
                          className="truncate text-end text-[13px] text-muted-foreground"
                        >
                          {link.url!.replace(/^https?:\/\//, "")}
                        </span>
                      </a>
                      <ExternalLink
                        className="size-4 shrink-0 text-[#9aa5a0]"
                        aria-hidden
                      />
                      {!readOnly && (
                        <RemoveButton
                          label={t("remove", { name: link.name })}
                          onClick={() => remove(link)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
                {linkOpen && (
                  <LinkForm
                    onCancel={() => setLinkOpen(false)}
                    onAdd={(url, title) =>
                      startTransition(async () => {
                        setError(null);
                        const result = await addLink(item.id, url, title);
                        if (result.ok) {
                          add(result.attachment);
                          setLinkOpen(false);
                        } else showError(result.error);
                      })
                    }
                  />
                )}
              </>
            )}

            {(files.length > 0 || uploading.length > 0) && (
              <>
                <h3 className={cn(heading, "mt-4")}>{t("files")}</h3>
                <ul className="flex flex-wrap gap-2.5">
                  {files.map((file) => (
                    <li key={file.id} className="relative">
                      <a
                        href={fileUrl(file)}
                        target="_blank"
                        rel="noopener"
                        className="flex size-21 flex-col items-center justify-center gap-1 overflow-hidden rounded-[14px] border bg-[#eef1f0] text-[11px] text-muted-foreground"
                      >
                        {isImageType(file.contentType) ? (
                          // eslint-disable-next-line @next/next/no-img-element -- private file behind our own route
                          <img
                            src={fileUrl(file)}
                            alt={file.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <>
                            <FileText className="size-5" aria-hidden />
                            <span className="w-full truncate px-1.5 text-center">
                              {file.name}
                            </span>
                          </>
                        )}
                      </a>
                      {!readOnly && (
                        <RemoveButton
                          label={t("remove", { name: file.name })}
                          onClick={() => remove(file)}
                          className="absolute -top-1.5 -end-1.5 size-6 border bg-card shadow-sm"
                        />
                      )}
                    </li>
                  ))}
                  {uploading.map((key) => (
                    <li
                      key={key}
                      className="flex size-21 flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-[#c3cbc7] text-[11px] text-muted-foreground"
                    >
                      <LoaderCircle
                        className="size-5 animate-spin text-primary"
                        aria-hidden
                      />
                      {t("uploading")}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!readOnly &&
              links.length === 0 &&
              files.length === 0 &&
              uploading.length === 0 &&
              !linkOpen && (
                <p className="mt-4 px-0.5 text-sm text-muted-foreground">
                  {t("empty")}
                </p>
              )}

            {error && (
              <p role="alert" className="mt-3 px-0.5 text-sm text-destructive">
                {error}
              </p>
            )}

            {!readOnly && (
              <div className="mt-4 flex gap-2">
                <AddButton
                  icon={Link2}
                  label={t("addLink")}
                  onClick={() => setLinkOpen(true)}
                  disabled={linkOpen}
                />
                <AddButton
                  icon={Camera}
                  label={t("photo")}
                  onClick={() => photoRef.current?.click()}
                />
                <AddButton
                  icon={Paperclip}
                  label={t("file")}
                  onClick={() => fileRef.current?.click()}
                />
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    void uploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={ALLOWED_FILE_TYPES.join(",")}
                  hidden
                  onChange={(e) => {
                    void uploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function AddButton({
  icon: Icon,
  label,
  ...props
}: { icon: typeof Plus; label: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-semibold transition-colors active:bg-muted disabled:opacity-50"
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

function RemoveButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted",
        className,
      )}
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

function LinkForm({
  onAdd,
  onCancel,
}: {
  onAdd: (url: string, title: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Attachments");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const field =
    "h-11 w-full rounded-xl border border-[#dfe3e1] bg-card px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim()) onAdd(url, title);
      }}
      className="mt-2 flex flex-col gap-2 rounded-[14px] border bg-card p-2.5"
    >
      <input
        autoFocus
        type="text"
        autoCapitalize="none"
        autoCorrect="off"
        inputMode="url"
        dir="ltr"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://"
        aria-label={t("linkUrl")}
        className={field}
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("linkTitle")}
        aria-label={t("linkTitle")}
        maxLength={100}
        className={field}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl"
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          className="h-10 flex-1 rounded-xl"
          disabled={!url.trim()}
        >
          {t("add")}
        </Button>
      </div>
    </form>
  );
}
