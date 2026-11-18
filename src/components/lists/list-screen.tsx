"use client";

import { useEffect, useRef } from "react";

/**
 * A list screen. On a phone, while the keyboard is open, it becomes a frame
 * the size of what is on screen, like a search screen in Instagram: the
 * list's top bar at the top, the chat box right above the keyboard, and the
 * list scrolling between them. Typing in another field (quick add) hides the
 * chat box. With the keyboard closed, the page scrolls as usual.
 *
 * iOS Safari doesn't shrink the page for the keyboard; it shows part of it
 * (the visual viewport) and pans that part around. So the frame takes the
 * visual viewport's size and place, measured only when the keyboard opens,
 * closes or iOS pans, not on every scroll: the list scrolls inside the frame.
 *
 * The parts: the top bar ([data-list-top]), the list ([data-list-body]) and
 * the chat box ([data-chat]); the styles are in globals.css.
 */
export function ListScreen({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    const viewport = window.visualViewport;
    if (!root || !viewport || !window.matchMedia("(pointer: coarse)").matches) return;

    const body = () => root.querySelector<HTMLElement>("[data-list-body]");
    const field = (el: Element | null) =>
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && root.contains(el) ? el : null;

    const size = () => {
      root.style.setProperty("--frame-h", `${viewport.height}px`);
      root.style.setProperty("--frame-top", `${viewport.offsetTop}px`);
    };

    const update = () => {
      const el = field(document.activeElement);
      const was = root.dataset.keyboard;
      if (el) {
        const mode = el.closest("[data-chat]") ? "chat" : "field";
        if (!was) {
          // Keep the list where it was: the page's scroll becomes the list's.
          const scrolled = window.scrollY;
          size();
          root.dataset.keyboard = mode;
          const list = body();
          if (list) list.scrollTop = scrolled;
        } else if (was !== mode) {
          root.dataset.keyboard = mode;
        }
      } else if (was) {
        const scrolled = body()?.scrollTop ?? 0;
        delete root.dataset.keyboard;
        window.scrollTo(0, scrolled);
      }
    };

    const onFocusIn = () => update();
    // When focus leaves a field, the next one (if any) has it by the next frame.
    const onFocusOut = () => requestAnimationFrame(update);
    const onViewport = () => root.dataset.keyboard && size();

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    viewport.addEventListener("resize", onViewport);
    viewport.addEventListener("scroll", onViewport);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      viewport.removeEventListener("resize", onViewport);
      viewport.removeEventListener("scroll", onViewport);
    };
  }, []);

  return (
    <div ref={ref} data-list-screen className="contents">
      {children}
    </div>
  );
}
