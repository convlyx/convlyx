import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { ITEMS_PER_PAGE } from "@/lib/constants/pagination";
import { StaffPageClient } from "./_components/staff-page-client";

const STAFF_ROLES = ["ADMIN", "SECRETARY"] as const;

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; search?: string; page?: string }>;
}) {
  await requireDashboardUser(["ADMIN"]);

  // Mirror StaffPageClient's useQuery input so the prefetched key matches.
  const sp = await searchParams;
  const roleFilter = sp.role ?? "ALL";
  const search = (sp.search ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const helpers = await getSsrHelpers();
  await helpers.user.list.prefetch({
    ...(roleFilter !== "ALL"
      ? { role: roleFilter as (typeof STAFF_ROLES)[number] }
      : { roles: [...STAFF_ROLES] }),
    ...(search && { search }),
    page,
    pageSize: ITEMS_PER_PAGE,
    includeAuthStatus: true,
  });

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <StaffPageClient />
    </HydrationBoundary>
  );
}
