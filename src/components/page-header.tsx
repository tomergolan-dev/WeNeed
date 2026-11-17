import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

/** A screen title with a back button, an optional subtitle and actions at the end. */
export function PageHeader({
  title,
  subtitle,
  back = "/",
  children,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("Nav");
  return (
    <header className="flex items-center gap-3 px-5 pt-4 pb-1">
      <Link
        href={back}
        aria-label={t("back")}
        className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border bg-card transition-colors active:bg-muted"
      >
        <ArrowRight className="size-5 ltr:-scale-x-100" aria-hidden />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-xl font-extrabold">{title}</h1>
        {subtitle && <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
