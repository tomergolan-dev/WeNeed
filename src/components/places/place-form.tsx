"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { createPlace, updatePlace } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { focusOnOpen } from "@/lib/focus";
import { PLACE_ICON_KEYS, PLACE_ICONS, type PlaceIcon } from "@/lib/place-icons";

type Props =
  | { mode: "create" }
  | { mode: "edit"; name: string; icon: PlaceIcon };

/** Name and icon of a place: creates a new one, or edits the current one. */
export function PlaceForm(props: Props) {
  const t = useTranslations("Places");
  const tSettings = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const initial = props.mode === "edit" ? { name: props.name, icon: props.icon } : { name: "", icon: "home" as PlaceIcon };
  const [name, setName] = useState(initial.name);
  const [icon, setIcon] = useState<PlaceIcon>(initial.icon);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = name.trim();
  const unchanged = props.mode === "edit" && trimmed === initial.name && icon === initial.icon;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const input = { name: trimmed, icon };
          const result = props.mode === "create" ? await createPlace(input) : await updatePlace(input);
          setMessage(
            result.ok
              ? { text: tSettings("saved"), error: false }
              : { text: tErrors(result.error), error: true },
          );
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="place-name">{t("nameLabel")}</Label>
        <Input
          id="place-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setMessage(null);
          }}
          placeholder={t("namePlaceholder")}
          maxLength={60}
          autoFocus={props.mode === "create" && focusOnOpen()}
          className="h-12 rounded-2xl bg-card px-4 text-base"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("iconLabel")}</legend>
        <div className="grid grid-cols-3 gap-2.5">
          {PLACE_ICON_KEYS.map((key) => {
            const { icon: Icon, tone } = PLACE_ICONS[key];
            const selected = key === icon;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setIcon(key);
                  setMessage(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-[18px] border bg-card py-3 text-[13px] transition-colors active:bg-muted",
                  selected && "border-2 border-primary py-[11px] font-semibold",
                )}
              >
                <span className={cn("flex size-10 items-center justify-center rounded-full", tone)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {t(`icons.${key}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Button type="submit" size="xl" disabled={pending || !trimmed || unchanged}>
        {props.mode === "create" ? t("create") : tSettings("save")}
      </Button>
      {message && (
        <p role="status" className={cn("text-center text-sm", message.error ? "text-destructive" : "text-muted-foreground")}>
          {message.text}
        </p>
      )}
    </form>
  );
}
