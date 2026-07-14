import { HydrationBoundary } from "@tanstack/react-query";
import { getAdminSsrHelpers } from "@/server/admin-ssr";
import { dehydrateSsr } from "@/server/ssr";
import { AccountDetail } from "./_components/account-detail";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ school?: string; range?: string }>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const schoolId = sp.school && sp.school !== "ALL" ? sp.school : undefined;
  const rangeRaw = Number(sp.range);
  const rangeDays = ([30, 90, 365] as number[]).includes(rangeRaw)
    ? (rangeRaw as 30 | 90 | 365)
    : 90;

  const helpers = await getAdminSsrHelpers();
  await Promise.all([
    helpers.admin.account.get.prefetch({ tenantId }),
    helpers.admin.account.charts.prefetch({ tenantId, ...(schoolId && { schoolId }), rangeDays }),
  ]);

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <AccountDetail tenantId={tenantId} />
    </HydrationBoundary>
  );
}
