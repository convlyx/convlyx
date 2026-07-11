import { notFound } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { db } from "@/server/db";
import { StudentDetailPage } from "./_components/student-detail-page";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const user = await requireDashboardUser(["ADMIN", "SECRETARY", "INSTRUCTOR"]);

  const studentExists = await db.membership.findFirst({
    where: { userId: id, tenantId: user.tenantId, role: "STUDENT" },
    select: { userId: true },
  });
  if (!studentExists) notFound();

  // Prefetch the header + overview (the visible detail content). The paginated
  // history section stays client-fetched.
  const helpers = await getSsrHelpers();
  await Promise.all([
    helpers.user.studentHeader.prefetch({ id }),
    helpers.user.studentOverview.prefetch({ id }),
  ]);

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <StudentDetailPage id={id} userRole={user.role} />
    </HydrationBoundary>
  );
}
