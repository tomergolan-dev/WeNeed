"use client";

import { useEffect, useRef } from "react";

/**
 * A list screen. On a phone (a touch screen narrower than the sidebar layout) it is a frame the size of
 * what is on screen, like a chat or a search screen in an app:
 * - the top bar (the list's name and quick add) never moves;
 * - the list scrolls inside, beneath it;
 * - the AI chat box sits at the bottom, and while typing to it, right above
 *   the keyboard. While typing in quick add it stays at the bottom of the
 *   screen, behind the keyboard, and the list still scrolls under the top bar.
 *
 * iOS Safari doesn't shrink the page for the keyboard; it shows part of it
 * (the visual viewport) and may pan that part. So the frame takes the visual
 * viewport's size and place. Those change only when the keyboard opens or
 * closes or iOS pans, never while the list scrolls (it scrolls inside the
 * frame), so nothing jitters.
 *
 * The layout is in globals.css (on touch screens only), with the parts marked
 * [data-list-top], [data-list-body] and [data-chat]. On a computer the page
 * scrolls as usual with a sticky top bar.
 */
/** Matches the media query in globals.css: touch screens narrower than the sidebar layout. */
const PHONE = "(pointer: coarse) and (max-width: 1023px)";

export function ListScreen({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    const viewport = window.visualViewport;
    if (!root || !viewport || !window.matchMedia(PHONE).matches) return;

    const update = () => {
      root.style.setProperty("--frame-h", `${viewport.height}px`);
      root.style.setProperty("--frame-top", `${viewport.offsetTop}px`);
      const el = document.activeElement;
      const typing = (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && root.contains(el);
      const mode = !typing ? null : el.closest("[data-chat]") ? "chat" : "field";
      if (mode) root.dataset.keyboard = mode;
      else delete root.dataset.keyboard;
    };

    // When focus leaves a field, the next one (if any) has it by the next frame.
    const later = () => requestAnimationFrame(update);
    update();
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", later);
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", later);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div ref={ref} data-list-screen className="contents">
      {children}
    </div>
  );
}
