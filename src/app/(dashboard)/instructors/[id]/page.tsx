import { notFound } from "next/navigation";
import { requireDashboardUser } from "@/server/dashboard-user";
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

  const instructorExists = await db.user.findFirst({
    where: { id, tenantId: user.tenantId, role: "INSTRUCTOR" },
    select: { id: true },
  });
  if (!instructorExists) notFound();

  return <InstructorDetailPage id={id} userRole={user.role} />;
}
