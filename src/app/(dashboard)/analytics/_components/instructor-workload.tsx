"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Users } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import type { AnalyticsRangeDays } from "@/lib/validations/analytics";
import { ChartCard } from "./chart-card";

export function InstructorWorkload({
  rangeDays,
  schoolId,
}: {
  rangeDays: AnalyticsRangeDays;
  schoolId?: string;
}) {
  const t = useTranslations();
  const { data, isLoading } = trpc.analytics.instructorWorkload.useQuery({
    rangeDays,
    ...(schoolId && { schoolId }),
  });

  return (
    <ChartCard
      title={t("analytics.instructorWorkload")}
      subtitle={t(`analytics.range.${rangeDays}`)}
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Users} message={t("analytics.noData")} />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <caption className="sr-only">{t("analytics.instructorWorkload")}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="text-right">{t("analytics.classes")}</TableHead>
                <TableHead className="text-right">{t("analytics.hours")}</TableHead>
                <TableHead className="text-right">{t("analytics.attendanceRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.instructorId} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{r.classes}</TableCell>
                  <TableCell className="text-right">{r.hours.toFixed(1)}</TableCell>
                  <TableCell className="text-right">
                    {r.attendanceRate === null
                      ? "—"
                      : `${Math.round(r.attendanceRate * 100)}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ChartCard>
  );
}
