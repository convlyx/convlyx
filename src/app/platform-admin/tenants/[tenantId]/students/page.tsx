import { StudentsList } from "./_components/students-list";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return <StudentsList tenantId={tenantId} />;
}
