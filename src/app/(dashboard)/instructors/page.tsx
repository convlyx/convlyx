import { requireDashboardUser } from "@/server/dashboard-user";
import { InstructorsPageClient } from "./_components/instructors-page-client";

export default async function InstructorsPage() {
  await requireDashboardUser(["ADMIN", "SECRETARY"]);
  return <InstructorsPageClient />;
}
