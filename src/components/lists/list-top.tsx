/** The top of a list screen, which stays in place while the list scrolls. */
export function ListTop({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <div data-list-top className="sticky top-0 z-20 bg-background pb-3 shadow-[0_1px_0_var(--line)]">
      {header}
      <div className="pt-2">{children}</div>
    </div>
  );
}
