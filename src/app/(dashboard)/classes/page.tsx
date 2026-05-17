import { requireDashboardUser } from "@/server/dashboard-user";
import { ClassesPageClient } from "./_components/classes-page-client";

export default async function ClassesPage() {
  const user = await requireDashboardUser();
  return <ClassesPageClient userRole={user.role} userId={user.id} />;
}
