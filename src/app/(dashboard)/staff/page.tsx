import { requireDashboardUser } from "@/server/dashboard-user";
import { StaffPageClient } from "./_components/staff-page-client";

export default async function StaffPage() {
  await requireDashboardUser(["ADMIN"]);
  return <StaffPageClient />;
}
