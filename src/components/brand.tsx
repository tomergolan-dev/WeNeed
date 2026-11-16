import { ShoppingCart } from "lucide-react";

/** The app logo: a cart in a soft green tile, and the name. */
export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-10 items-center justify-center rounded-[14px] bg-accent text-primary">
        <ShoppingCart className="size-5" aria-hidden />
      </span>
      <span dir="ltr" className="text-[19px] font-extrabold tracking-tight">
        WeNeed
      </span>
    </span>
  );
}
