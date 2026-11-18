"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps an element on the part of the page that is on screen while the
 * phone's keyboard is open, like a search screen in Instagram: the list's
 * top bar at the top, the AI chat box right above the keyboard, and the
 * list scrolling between them.
 *
 * iOS Safari doesn't shrink the page for the keyboard. It moves the visible
 * part (the visual viewport) instead, so a sticky top bar slides off the top
 * and a fixed bottom bar hides behind the keyboard. This follows the visual
 * viewport and moves the element back into view. With no keyboard (and on
 * phones that shrink the page instead) the shift is 0.
 */
export function usePinToVisualViewport<T extends HTMLElement>(edge: "top" | "bottom") {
  const ref = useRef<T>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = ref.current;
        if (!element) return;
        const shift =
          edge === "top"
            ? viewport.offsetTop
            : -(window.innerHeight - viewport.height - viewport.offsetTop);
        element.style.transform = Math.abs(shift) > 1 ? `translateY(${shift}px)` : "";
      });
    };
    viewport.addEventListener("resize", place);
    viewport.addEventListener("scroll", place);
    place();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", place);
      viewport.removeEventListener("scroll", place);
    };
  }, [edge]);
  return ref;
}
