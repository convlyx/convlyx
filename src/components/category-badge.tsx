import { useTranslations } from "next-intl";
import type { LicenseCategory } from "@/lib/license-categories";

/** Compact category badge shown on class cards, exam rows, calendar events, etc. */
export function CategoryBadge({ category }: { category: LicenseCategory | null | undefined }) {
  const t = useTranslations();
  if (!category) return null;
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {t(`categories.${category}`)}
    </span>
  );
}
