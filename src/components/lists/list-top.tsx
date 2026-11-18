"use client";

import { usePinToVisualViewport } from "@/lib/visual-viewport";

/** The top of a list screen, which stays in place while the list scrolls, also with the keyboard open. */
export function ListTop({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const ref = usePinToVisualViewport<HTMLDivElement>("top");
  return (
    <div ref={ref} className="sticky top-0 z-20 bg-background pb-3 shadow-[0_1px_0_#eef0ef]">
      {header}
      <div className="pt-2">{children}</div>
    </div>
  );
}
