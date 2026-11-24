"use client";

import { useEffect, useLayoutEffect } from "react";
import { useLocale } from "next-intl";
import { applyTheme, subscribeTheme } from "@/lib/theme";

/**
 * Keeps the theme on the page: follows the device turning dark or light while
 * the app is open (when the choice is "system"), and puts it back after a
 * language switch, which renders <html> anew without the "dark" the head
 * script added on the first load.
 */
export function ThemeWatcher() {
  const locale = useLocale();
  useLayoutEffect(applyTheme, [locale]);
  useEffect(() => subscribeTheme(applyTheme), []);
  return null;
}
