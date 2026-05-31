import { requireDashboardUser } from "@/server/dashboard-user";
import { DashboardView } from "./_components/dashboard-view";
import { StudentHome } from "./_components/student-home";
import { InstructorHome } from "./_components/instructor-home";

export default async function DashboardPage() {
  const user = await requireDashboardUser();

  if (user.role === "STUDENT") {
    return <StudentHome userId={user.id} />;
  }

  if (user.role === "INSTRUCTOR") {
    return <InstructorHome userId={user.id} />;
  }

  return <DashboardView userName={user.name} userRole={user.role} />;
}
