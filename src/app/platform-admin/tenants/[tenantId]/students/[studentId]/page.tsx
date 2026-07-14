import { StudentDetail } from "./_components/student-detail";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; studentId: string }>;
}) {
  const { tenantId, studentId } = await params;
  return <StudentDetail tenantId={tenantId} studentUserId={studentId} />;
}
