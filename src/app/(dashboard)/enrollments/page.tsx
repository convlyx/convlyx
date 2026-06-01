import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { ITEMS_PER_PAGE } from "@/lib/constants/pagination";
import { EnrollmentsList } from "./_components/enrollments-list";

export default async function EnrollmentsPage() {
  const user = await requireDashboardUser();

  // EnrollmentsList's initial query uses fixed defaults (time "current", page 1
  // — local state, not URL params), so the prefetch input is constant.
  const helpers = await getSsrHelpers();
  await helpers.enrollment.listByStudent.prefetch({
    time: "current",
    page: 1,
    pageSize: ITEMS_PER_PAGE,
  });

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <EnrollmentsList userRole={user.role} />
    </HydrationBoundary>
  );
}
