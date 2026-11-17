import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DemoShell } from "@/components/demo/demo-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Demo");
  return { description: t("banner") };
}

/** The public demo: no sign-in, and everything stays in the visitor's browser. */
export default function DemoLayout({ children }: LayoutProps<"/[locale]/demo">) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <DemoShell>{children}</DemoShell>
    </div>
  );
}
