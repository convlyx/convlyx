import { requireDashboardUser } from "@/server/dashboard-user";
import { StudentsPageClient } from "./_components/students-page-client";

export default async function StudentsPage() {
  const user = await requireDashboardUser(["ADMIN", "SECRETARY", "INSTRUCTOR"]);
  return <StudentsPageClient userRole={user.role} />;
}
