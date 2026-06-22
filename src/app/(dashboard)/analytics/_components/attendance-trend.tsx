"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { BookCheck } from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import type { AnalyticsRangeDays } from "@/lib/validations/analytics";
import { formatBucket } from "./bucket-label";
import { ChartCard } from "./chart-card";
import { SrDataTable } from "@/components/sr-data-table";

export function AttendanceTrend({
  rangeDays,
  schoolId,
}: {
  rangeDays: AnalyticsRangeDays;
  schoolId?: string;
}) {
  const t = useTranslations();
  const { data, isLoading } = trpc.analytics.attendanceTrend.useQuery({
    rangeDays,
    ...(schoolId && { schoolId }),
  });

  const items = data?.items ?? [];
  const granularity = data?.granularity ?? "day";
  const hasData = items.some((d) => d.classes > 0);

  return (
    <ChartCard
      title={t("analytics.attendanceTrend")}
      subtitle={t(`analytics.range.${rangeDays}`)}
    >
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !hasData ? (
        <EmptyState icon={BookCheck} message={t("analytics.noData")} />
      ) : (
        <>
        <div className="h-64 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={items.map((d) => ({
                label: formatBucket(d.bucket, granularity),
                classes: d.classes,
                attendancePct: Math.round(d.attendanceRate * 100),
              }))}
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
                yAxisId="left"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                unit="%"
              />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                labelStyle={{ color: "var(--foreground)" }}
              />
              <Legend
                wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.5rem" }}
                iconType="circle"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="classes"
                name={t("analytics.classes")}
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="attendancePct"
                name={t("analytics.attendanceRate")}
                stroke="var(--success)"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                unit="%"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <SrDataTable
          caption={t("analytics.attendanceTrend")}
          columns={[t("analytics.period"), t("analytics.classes"), t("analytics.attendanceRate")]}
          rows={items.map((d) => [
            formatBucket(d.bucket, granularity),
            d.classes,
            `${Math.round(d.attendanceRate * 100)}%`,
          ])}
        />
        </>
      )}
    </ChartCard>
  );
}
