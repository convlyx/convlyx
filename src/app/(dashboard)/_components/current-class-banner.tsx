"use client";

import Link from "next/link";
import { useTranslations, useNow } from "next-intl";
import { Radio } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * Shows a link to the QR check-in display when the instructor has a theory
 * class happening right now. Reuses the today query already loaded by the
 * instructor home (same query key → no extra request). Matches any
 * non-finished theory class inside its time window so it appears even before
 * the status-sync cron flips the class to IN_PROGRESS.
 */
export function CurrentClassBanner({ todayRange }: { todayRange: { from: string; to: string } }) {
  const t = useTranslations("checkin");
  const { data } = trpc.class.list.useQuery(todayRange);

  // Shared "now" inherited from the server (see i18n.ts) so the banner's
  // presence is identical on SSR and hydration; re-checks each minute.
  const now = useNow({ updateInterval: 60_000 }).getTime();
  const current = data?.items.find(
    (c) =>
      c.classType === "THEORY" &&
      c.status !== "CANCELLED" &&
      c.status !== "COMPLETED" &&
      new Date(c.startsAt).getTime() <= now &&
      now <= new Date(c.endsAt).getTime(),
  );
  if (!current) return null;

  return (
    <Link
      href={`/checkin-display/${current.id}`}
      className="flex items-center gap-3 rounded-2xl border border-primary bg-primary/5 p-4 transition-all hover:card-shadow-hover"
    >
      <Radio className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {t("bannerInProgress")} · {current.title}
        </p>
        <p className="text-xs font-medium text-primary">{t("bannerAction")}</p>
      </div>
    </Link>
  );
}
