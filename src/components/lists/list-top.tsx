"use client";

import { SelectTopBar, useListSelection } from "./bulk-delete";

/**
 * The top of a list screen, which stays in place while the list scrolls.
 * While picking items to delete, it shows the picking bar instead.
 */
export function ListTop({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const picking = useListSelection();
  return (
    <div data-list-top className="sticky top-0 z-20 bg-background pb-3 shadow-[0_1px_0_#eef0ef]">
      {picking?.selection.selecting ? (
        <SelectTopBar selection={picking.selection} />
      ) : (
        <>
          {header}
          <div className="pt-2">{children}</div>
        </>
      )}
    </div>
  );
}
