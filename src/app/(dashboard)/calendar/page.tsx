import { requireDashboardUser } from "@/server/dashboard-user";
import { CalendarView } from "./_components/calendar-view";

export default async function CalendarPage() {
  const user = await requireDashboardUser();
  return <CalendarView userRole={user.role} userId={user.id} />;
}
