import { notFound } from "next/navigation";
import { requireDashboardUser } from "@/server/dashboard-user";
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

  const studentExists = await db.user.findFirst({
    where: { id, tenantId: user.tenantId, role: "STUDENT" },
    select: { id: true },
  });
  if (!studentExists) notFound();

  return <StudentDetailPage id={id} userRole={user.role} />;
}
