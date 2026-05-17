"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useUrlParam, useUrlParamInt } from "@/hooks/use-url-param";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { ANALYTICS_RANGE_DAYS, type AnalyticsRangeDays } from "@/lib/validations/analytics";
import { SnapshotRow } from "./snapshot-row";
import { EnrolmentsOverTime } from "./enrolments-over-time";
import { AttendanceTrend } from "./attendance-trend";
import { PassRateByCategory } from "./pass-rate-by-category";
import { InstructorWorkload } from "./instructor-workload";

const ALL = "ALL";
const DEFAULT_RANGE_DAYS = 30 as const;

export function AnalyticsPageClient() {
  const t = useTranslations();

  // URL-synced filters — survive refresh, shareable links, browser-back works.
  const [schoolFilter, setSchoolFilter] = useUrlParam<string>("school", ALL);
  const [rangeRaw, setRangeRaw] = useUrlParamInt("range", DEFAULT_RANGE_DAYS);

  // Validate against the allowlist — a tampered URL like ?range=42 should
  // fall back to the default rather than 500'ing the tRPC query.
  const allowedRanges = ANALYTICS_RANGE_DAYS as ReadonlyArray<number>;
  const rangeDays: AnalyticsRangeDays = (
    allowedRanges.includes(rangeRaw) ? rangeRaw : DEFAULT_RANGE_DAYS
  ) as AnalyticsRangeDays;

  // Cheap: school.list already exists, and tenants typically have 1–5 schools.
  // We only show the selector when there's more than one school in the tenant.
  const { data: schools } = trpc.school.list.useQuery();
  const hasMultipleSchools = (schools?.length ?? 0) > 1;
  const schoolId = schoolFilter === ALL ? undefined : schoolFilter;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("nav.analytics")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(rangeDays)}
            onValueChange={(v) => setRangeRaw(Number(v))}
          >
            <SelectTrigger className="w-auto min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANALYTICS_RANGE_DAYS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {t(`analytics.range.${days}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasMultipleSchools && (
            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
              <SelectTrigger className="w-auto min-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("analytics.allSchools")}</SelectItem>
                {schools?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <SnapshotRow rangeDays={rangeDays} schoolId={schoolId} />
      <EnrolmentsOverTime rangeDays={rangeDays} schoolId={schoolId} />
      <AttendanceTrend rangeDays={rangeDays} schoolId={schoolId} />
      <PassRateByCategory rangeDays={rangeDays} schoolId={schoolId} />
      <InstructorWorkload rangeDays={rangeDays} schoolId={schoolId} />
    </div>
  );
}
