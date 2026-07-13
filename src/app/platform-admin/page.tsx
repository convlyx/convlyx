import { HydrationBoundary } from "@tanstack/react-query";
import { getAdminSsrHelpers } from "@/server/admin-ssr";
import { dehydrateSsr } from "@/server/ssr";
import { PortfolioOverview } from "./_components/portfolio-overview";

// Cross-tenant live data — never static-render at build time.
export const dynamic = "force-dynamic";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type RiskFilter = "ALL" | "HEALTHY" | "AT_RISK" | "NEW" | "INACTIVE";
type SortKey = "name" | "createdAt" | "students" | "classes30d";

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; risk?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  // Mirror PortfolioOverview's input derivation exactly so prefetch keys match.
  const page = Number(sp.page) >= 1 ? Number(sp.page) : 1;
  const overviewInput = {
    page,
    pageSize: 10,
    ...(sp.q ? { search: sp.q } : {}),
    status: (sp.status as StatusFilter) ?? "ALL",
    risk: (sp.risk as RiskFilter) ?? "ALL",
    sort: (sp.sort as SortKey) ?? "name",
  };

  const helpers = await getAdminSsrHelpers();
  await Promise.all([
    helpers.admin.portfolio.kpis.prefetch(),
    helpers.admin.portfolio.trends.prefetch({ rangeDays: 90 }),
    helpers.admin.portfolio.overview.prefetch(overviewInput),
  ]);

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <PortfolioOverview />
    </HydrationBoundary>
  );
}
