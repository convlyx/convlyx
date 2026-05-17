import { notFound, redirect } from "next/navigation";
import { requireDashboardUser } from "@/server/dashboard-user";
import { db } from "@/server/db";
import { ClassDetailView } from "./_components/class-detail-view";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  // Wrong-role users land on /classes (not /) so they see something useful.
  const user = await requireDashboardUser();
  if (!["ADMIN", "SECRETARY", "INSTRUCTOR"].includes(user.role)) redirect("/classes");

  // Verify the class exists in this tenant (instructors can only see their own)
  const classExists = await db.classSession.findFirst({
    where: {
      id,
      tenantId: user.tenantId,
      ...(user.role === "INSTRUCTOR" && { instructorId: user.id }),
    },
    select: { id: true },
  });
  if (!classExists) notFound();

  return <ClassDetailView classId={id} userRole={user.role} />;
}
