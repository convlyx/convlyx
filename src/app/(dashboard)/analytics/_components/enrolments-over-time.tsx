"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ClipboardList } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { AnalyticsRangeDays } from "@/lib/validations/analytics";
import { formatBucket } from "./bucket-label";
import { ChartCard } from "./chart-card";
import { SrDataTable } from "@/components/sr-data-table";

export function EnrolmentsOverTime({
  rangeDays,
  schoolId,
}: {
  rangeDays: AnalyticsRangeDays;
  schoolId?: string;
}) {
  const t = useTranslations();
  const { data, isLoading } = trpc.analytics.enrolmentsOverTime.useQuery({
    rangeDays,
    ...(schoolId && { schoolId }),
  });

  const items = data?.items ?? [];
  const granularity = data?.granularity ?? "day";

  return (
    <ChartCard
      title={t("analytics.enrolmentsOverTime")}
      subtitle={t(`analytics.range.${rangeDays}`)}
    >
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.every((d) => d.count === 0) ? (
        <EmptyState icon={ClipboardList} message={t("analytics.noData")} />
      ) : (
        <>
        <div className="h-64 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={items.map((d) => ({ ...d, label: formatBucket(d.bucket, granularity) }))}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(value) => [`${value}`, t("analytics.enrolments")]}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SrDataTable
          caption={t("analytics.enrolmentsOverTime")}
          columns={[t("analytics.period"), t("analytics.enrolments")]}
          rows={items.map((d) => [formatBucket(d.bucket, granularity), d.count])}
        />
        </>
      )}
    </ChartCard>
  );
}
