import { requireDashboardUser } from "@/server/dashboard-user";
import { CheckInDisplay } from "./_components/checkin-display";

export default async function CheckInDisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireDashboardUser(["ADMIN", "SECRETARY", "INSTRUCTOR"]);
  const { id } = await params;
  return <CheckInDisplay sessionId={id} />;
}
