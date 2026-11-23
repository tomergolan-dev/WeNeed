"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Smartphone } from "lucide-react";

/**
 * On a phone held sideways, a note to turn it upright covers the app: iOS
 * lets no website or home-screen app lock the screen's rotation (Android
 * keeps an installed app upright through the manifest). Reads the screen's
 * orientation rather than the window's shape, so an open keyboard never
 * counts as sideways.
 */
export function PortraitOnly() {
  const t = useTranslations("Nav");
  const sideways = useSyncExternalStore(subscribe, isPhoneSideways, () => false);
  if (!sideways) return null;
  return (
    <div role="alert" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background px-8 text-center">
      <Smartphone className="size-7 text-muted-foreground" aria-hidden />
      <p className="text-[15px] font-medium">{t("rotate")}</p>
    </div>
  );
}

function isPhoneSideways() {
  const type = screen.orientation?.type ?? (Math.abs(Number(window.orientation)) === 90 ? "landscape" : "portrait");
  // A phone's short side is under 500px; tablets and computers may turn as they like.
  const phone = Math.min(screen.width, screen.height) < 500 && matchMedia("(pointer: coarse)").matches;
  return phone && type.startsWith("landscape");
}

function subscribe(onChange: () => void) {
  screen.orientation?.addEventListener("change", onChange);
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    screen.orientation?.removeEventListener("change", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("resize", onChange);
  };
}
