import { requireDashboardUser } from "@/server/dashboard-user";
import { EnrollmentsList } from "./_components/enrollments-list";

export default async function EnrollmentsPage() {
  const user = await requireDashboardUser();
  return <EnrollmentsList userRole={user.role} />;
}
