import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { ANALYTICS_RANGE_DAYS, type AnalyticsRangeDays } from "@/lib/validations/analytics";
import { AnalyticsPageClient } from "./_components/analytics-page-client";

const DEFAULT_RANGE_DAYS = 30;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; school?: string }>;
}) {
  await requireDashboardUser(["ADMIN"]);

  // Mirror AnalyticsPageClient's filter derivation so the prefetched keys match.
  const sp = await searchParams;
  const rangeRaw = Number(sp.range);
  const allowed = ANALYTICS_RANGE_DAYS as ReadonlyArray<number>;
  const rangeDays = (allowed.includes(rangeRaw) ? rangeRaw : DEFAULT_RANGE_DAYS) as AnalyticsRangeDays;
  const schoolId = sp.school && sp.school !== "ALL" ? sp.school : undefined;
  const input = { rangeDays, ...(schoolId && { schoolId }) };

  const helpers = await getSsrHelpers();
  await Promise.all([
    helpers.analytics.snapshot.prefetch(input),
    helpers.analytics.enrolmentsOverTime.prefetch(input),
    helpers.analytics.attendanceTrend.prefetch(input),
    helpers.analytics.passRateByCategory.prefetch(input),
    helpers.analytics.instructorWorkload.prefetch(input),
    helpers.school.list.prefetch(),
  ]);

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <AnalyticsPageClient />
    </HydrationBoundary>
  );
}
