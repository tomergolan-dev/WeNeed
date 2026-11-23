"use client";

import { useEffect } from "react";
import { applyTheme, subscribeTheme } from "@/lib/theme";

/** Follows the device turning dark or light while the app is open (when the choice is "system"). */
export function ThemeWatcher() {
  useEffect(() => subscribeTheme(applyTheme), []);
  return null;
}
