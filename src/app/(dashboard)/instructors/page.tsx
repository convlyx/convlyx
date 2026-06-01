import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { ITEMS_PER_PAGE } from "@/lib/constants/pagination";
import { InstructorsPageClient } from "./_components/instructors-page-client";

export default async function InstructorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  await requireDashboardUser(["ADMIN", "SECRETARY"]);

  // Mirror InstructorsPageClient's useQuery input so the prefetched key matches.
  const sp = await searchParams;
  const status = (sp.status as "ACTIVE" | "INACTIVE" | "ALL" | undefined) ?? "ACTIVE";
  const search = (sp.search ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const helpers = await getSsrHelpers();
  await helpers.user.list.prefetch({
    role: "INSTRUCTOR",
    ...(status !== "ALL" && { status }),
    ...(search && { search }),
    page,
    pageSize: ITEMS_PER_PAGE,
    includeAuthStatus: true,
  });

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <InstructorsPageClient />
    </HydrationBoundary>
  );
}
