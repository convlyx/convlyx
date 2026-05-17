import { requireDashboardUser } from "@/server/dashboard-user";
import { AnalyticsPageClient } from "./_components/analytics-page-client";

export default async function AnalyticsPage() {
  await requireDashboardUser(["ADMIN"]);
  return <AnalyticsPageClient />;
}
