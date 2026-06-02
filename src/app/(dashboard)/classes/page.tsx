import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { ITEMS_PER_PAGE } from "@/lib/constants/pagination";
import { type LicenseCategory } from "@/lib/license-categories";
import { ClassesPageClient } from "./_components/classes-page-client";

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    category?: string;
    instructor?: string;
    status?: string;
    time?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const user = await requireDashboardUser();
  const isStudent = user.role === "STUDENT";

  // Mirror ClassesTable's useQuery input so the prefetched key matches. The
  // status default depends on the time tab; students always query "upcoming"
  // and skip pagination (their list filters client-side).
  const sp = await searchParams;
  const typeFilter = sp.type ?? "ALL";
  const categoryFilter = sp.category ?? "ALL";
  const instructorFilter = sp.instructor ?? "ALL";
  const timeTab = (sp.time as "upcoming" | "past") ?? "upcoming";
  const statusFilter = (sp.status || (timeTab === "upcoming" ? "SCHEDULED" : "COMPLETED")) as
    | "ALL"
    | "SCHEDULED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";
  const search = (sp.search ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const helpers = await getSsrHelpers();
  await helpers.class.list.prefetch({
    ...(typeFilter !== "ALL" && { classType: typeFilter as "THEORY" | "PRACTICAL" }),
    ...(categoryFilter !== "ALL" && { category: categoryFilter as LicenseCategory }),
    ...(instructorFilter !== "ALL" && { instructorId: instructorFilter }),
    status: statusFilter,
    ...(search && { search }),
    time: isStudent ? "upcoming" : timeTab,
    ...(!isStudent && { page, pageSize: ITEMS_PER_PAGE }),
  });

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <ClassesPageClient userRole={user.role} userId={user.id} />
    </HydrationBoundary>
  );
}
