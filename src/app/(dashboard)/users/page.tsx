import { requireDashboardUser } from "@/server/dashboard-user";
import { UsersPageClient } from "./_components/users-page-client";

export default async function UsersPage() {
  const user = await requireDashboardUser(["ADMIN"]);
  return <UsersPageClient userRole={user.role} />;
}
