import { notFound } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { db } from "@/server/db";
import { InstructorDetailPage } from "./_components/instructor-detail-page";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InstructorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const user = await requireDashboardUser(["ADMIN", "SECRETARY"]);

  const instructorExists = await db.membership.findFirst({
    where: { userId: id, tenantId: user.tenantId, role: "INSTRUCTOR" },
    select: { userId: true },
  });
  if (!instructorExists) notFound();

  // Prefetch the header + overview (the visible detail content). The paginated
  // session history stays client-fetched.
  const helpers = await getSsrHelpers();
  await Promise.all([
    helpers.user.instructorHeader.prefetch({ id }),
    helpers.user.instructorOverview.prefetch({ id }),
  ]);

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <InstructorDetailPage id={id} userRole={user.role} />
    </HydrationBoundary>
  );
}
