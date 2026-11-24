"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { DEMO_PLACE, DemoProvider, demoUrgent, summarizeLists, useDemo } from "./demo-store";

/** The demo's frame: the sample place in this browser. The home screen says it's a demo (DemoNote). */
export function DemoShell({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider fallback={<DemoSkeleton />}>
      <div className="flex w-full flex-1">
        <DemoSidebar />
        <div className="mx-auto flex w-full min-w-0 max-w-xl flex-1 flex-col lg:max-w-3xl xl:max-w-4xl">{children}</div>
      </div>
    </DemoProvider>
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
