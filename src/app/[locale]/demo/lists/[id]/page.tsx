import { Suspense } from "react";
import { DemoList } from "@/components/demo/demo-list";

export default function DemoListPage() {
  // The list comes from the visitor's browser, so the page only reads the id there.
  return (
    <Suspense>
      <DemoList />
    </Suspense>
  );
}
