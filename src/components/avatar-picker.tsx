"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Camera, LoaderCircle } from "lucide-react";
import { setAvatarIcon, setAvatarPhoto } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { AVATAR_ICON_KEYS, AVATAR_PX, parseAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * Choosing the badge, under it in the account settings: a photo from the
 * phone, one of a few icons, or the first letter of the name. A choice
 * applies at once and closes the picker.
 */
export function AvatarPicker({ name, avatar, onDone }: { name: string; avatar: string | null; onDone: () => void }) {
  const t = useTranslations("Account");
  const tErrors = useTranslations("Errors");
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = parseAvatar(avatar);

  const apply = (work: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await work();
        if (result.ok) onDone();
        else setError(tErrors(result.error === "invalid" ? "invalid" : "generic"));
      } catch {
        setError(tErrors("generic"));
      }
    });

  const option = "flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow";
  const on = "ring-2 ring-primary";

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-start">
      <button
        type="button"
        disabled={pending}
        onClick={() => fileRef.current?.click()}
        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-accent-foreground active:opacity-80 disabled:opacity-50"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
        {t("avatarUpload")}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          apply(async () => {
            const form = new FormData();
            form.append("photo", await squareJpeg(file), "photo.jpg");
            return setAvatarPhoto(form);
          });
        }}
      />
      <p className="text-[13px] text-muted-foreground">{t("avatarOr")}</p>
      <div className="grid grid-cols-5 justify-items-center gap-2.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => apply(() => setAvatarIcon(null))}
          aria-label={t("avatarLetter")}
          aria-pressed={current.kind === "letter"}
          className={cn(option, current.kind === "letter" && on)}
        >
          <Avatar name={name} className="size-11" />
        </button>
        {AVATAR_ICON_KEYS.map((key) => {
          const chosen = current.kind === "icon" && current.key === key;
          return (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => apply(() => setAvatarIcon(key))}
              aria-label={t("avatarIcon")}
              aria-pressed={chosen}
              className={cn(option, chosen && on)}
            >
              <Avatar name={name} avatar={`icon:${key}`} className="size-11" />
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button type="button" onClick={onDone} className="h-9 text-sm text-muted-foreground active:text-foreground">
        {t("cancel")}
      </button>
    </div>
  );
}

/** The middle square of a photo, AVATAR_PX wide, as JPEG: small enough to send as is. */
async function squareJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = AVATAR_PX;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
