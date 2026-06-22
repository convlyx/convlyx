"use client";

import { useTranslations } from "next-intl";

/**
 * Visually-hidden live region announcing a loading state to screen readers.
 * Drop one inside the root of each skeleton placeholder so async fetches are
 * announced (skeletons are otherwise purely visual). See ACCESSIBILITY_AUDIT.
 */
export function LoadingAnnounce() {
  const t = useTranslations("common");
  return (
    <span role="status" className="sr-only">
      {t("loading")}
    </span>
  );
}
