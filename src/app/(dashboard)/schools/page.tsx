import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { SchoolsPageClient } from "./_components/schools-page-client";

export default async function SchoolsPage() {
  await requireDashboardUser(["ADMIN"]);

  const helpers = await getSsrHelpers();
  await helpers.school.list.prefetch();

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <SchoolsPageClient />
    </HydrationBoundary>
  );
}
