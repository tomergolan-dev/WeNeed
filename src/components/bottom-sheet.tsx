"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

/** A bottom sheet in the app's style: handle, title (with an optional small line under it) and a close button. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Places");
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-xl rounded-t-[28px] bg-[#f6f8f7] px-5 pt-2.5 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <div aria-hidden className="mx-auto mb-3.5 h-1.5 w-10 rounded-full bg-[#d5dad8]" />
        <div className="mb-3.5 flex items-center justify-between">
          <div className="min-w-0">
            <DrawerTitle className="text-xl font-extrabold">{title}</DrawerTitle>
            {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</p>}
          </div>
          <DrawerClose
            aria-label={t("close")}
            className="flex size-10 items-center justify-center rounded-full bg-[#eceff0] text-[#4c5853]"
          >
            <X className="size-4" aria-hidden />
          </DrawerClose>
        </div>
        {children}
      </DrawerContent>
    </Drawer>
  );
}
