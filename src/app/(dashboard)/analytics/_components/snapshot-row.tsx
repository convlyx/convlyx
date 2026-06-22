"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { StatRowSkeleton } from "@/components/skeletons/stat-row-skeleton";
import { TrendingUp, TrendingDown, Minus, Users, ClipboardList, BookCheck, GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CardData = {
  icon: LucideIcon;
  label: string;
  value: string;
  delta: number | null;
};

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        —
      </span>
    );
  }
  const up = delta > 0;
  const flat = delta === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const colour = flat
    ? "text-muted-foreground"
    : up
      ? "text-success"
      : "text-destructive";
  // Always display deltas as %. For rates (attendance / pass) the underlying
  // number is already in percentage points — the % label is read by users
  // as "went up by 4 next to the 85%", which is the right mental model.
  // Industry consensus (Stripe, Linear, Plausible) does the same.
  const formatted = `${up ? "+" : ""}${delta.toFixed(1)}%`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${colour}`}>
      <Icon className="h-3 w-3" />
      {formatted}
    </span>
  );
}

import type { AnalyticsRangeDays } from "@/lib/validations/analytics";

export function SnapshotRow({
  rangeDays,
  schoolId,
}: {
  rangeDays: AnalyticsRangeDays;
  schoolId?: string;
}) {
  const t = useTranslations();
  const { data, isLoading } = trpc.analytics.snapshot.useQuery({
    rangeDays,
    ...(schoolId && { schoolId }),
  });

  if (isLoading || !data) return <StatRowSkeleton count={4} />;

  const cards: CardData[] = [
    {
      icon: GraduationCap,
      label: t("analytics.newStudents"),
      value: String(data.newStudents.value),
      delta: data.newStudents.delta,
    },
    {
      icon: ClipboardList,
      label: t("analytics.enrolments"),
      value: String(data.enrolments.value),
      delta: data.enrolments.delta,
    },
    {
      icon: BookCheck,
      label: t("analytics.attendanceRate"),
      value: `${Math.round(data.attendanceRate.value * 100)}%`,
      delta: data.attendanceRate.delta,
    },
    {
      icon: Users,
      label: t("analytics.passRate"),
      value: `${Math.round(data.passRate.value * 100)}%`,
      delta: data.passRate.delta,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 animate-in fade-in duration-300">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold">{c.value}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <DeltaBadge delta={c.delta} />
              <span className="text-xs text-muted-foreground">{t("analytics.vsPrevious")}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
