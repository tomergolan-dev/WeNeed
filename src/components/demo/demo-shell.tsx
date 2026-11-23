"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { DEMO_PLACE, DemoProvider, demoUrgent, summarizeLists, useDemo } from "./demo-store";

/** The demo's frame: the sample place in this browser, and a strip that says so. */
export function DemoShell({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider fallback={<DemoSkeleton />}>
      <div className="flex w-full flex-1">
        <DemoSidebar />
        {/* The strip sits above the content, not the sidebar, so the sidebar keeps the full screen height. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <DemoStrip />
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col lg:max-w-3xl xl:max-w-4xl">{children}</div>
        </div>
      </div>
    </DemoProvider>
  );
}

function DemoStrip() {
  const t = useTranslations("Demo");
  const { reset } = useDemo();
  return (
    <div className="flex items-center gap-2 bg-accent px-5 py-2 text-[13px] text-accent-foreground">
      <p className="flex-1">{t("banner")}</p>
      <button
        type="button"
        onClick={reset}
        className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-semibold active:bg-black/5"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        {t("reset")}
      </button>
    </div>
  );
}

function DemoSidebar() {
  const { state } = useDemo();
  const [now] = useState(() => Date.now());
  const groups = [{ id: DEMO_PLACE, name: state.place, icon: "home", lists: summarizeLists(state, now) }];
  return (
    <Sidebar groups={groups} currentId={DEMO_PLACE} urgent={demoUrgent(state, now)} base="/demo" switchable={false} />
  );
}

function DemoSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5 pt-4" aria-hidden>
      <div className="h-11 w-2/3 animate-pulse rounded-xl bg-muted" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-[18px] bg-muted" />
      ))}
    </div>
  );
}
