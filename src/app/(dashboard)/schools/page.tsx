import { requireDashboardUser } from "@/server/dashboard-user";
import { SchoolsPageClient } from "./_components/schools-page-client";

export default async function SchoolsPage() {
  await requireDashboardUser(["ADMIN"]);
  return <SchoolsPageClient />;
}
