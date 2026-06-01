import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { ITEMS_PER_PAGE } from "@/lib/constants/pagination";
import { StudentsPageClient } from "./_components/students-page-client";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const user = await requireDashboardUser(["ADMIN", "SECRETARY", "INSTRUCTOR"]);

  // Mirror the client's query input (StudentsPageClient) so the prefetched
  // cache entry's key matches its useQuery — otherwise the client refetches and
  // we lose the benefit. Defaults must stay in sync with the URL-param hooks.
  const sp = await searchParams;
  const status = (sp.status as "ACTIVE" | "INACTIVE" | "ALL" | undefined) ?? "ACTIVE";
  const search = (sp.search ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const helpers = await getSsrHelpers();
  await helpers.user.list.prefetch({
    role: "STUDENT",
    ...(status !== "ALL" && { status }),
    ...(search && { search }),
    page,
    pageSize: ITEMS_PER_PAGE,
    includeAuthStatus: true,
  });

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <StudentsPageClient userRole={user.role} />
    </HydrationBoundary>
  );
}
