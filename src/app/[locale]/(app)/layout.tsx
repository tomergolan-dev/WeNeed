export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">{children}</div>;
}
