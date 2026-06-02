import { HydrationBoundary } from "@tanstack/react-query";
import { requireDashboardUser } from "@/server/dashboard-user";
import { getSsrHelpers, dehydrateSsr } from "@/server/ssr";
import { getPanelRanges } from "@/lib/dashboard-ranges";
import { DashboardView } from "./_components/dashboard-view";
import { StudentHome } from "./_components/student-home";
import { InstructorHome } from "./_components/instructor-home";

export default async function DashboardPage() {
  const user = await requireDashboardUser();

  // Compute ranges once on the server and pass them to the (client) panels, so
  // the prefetch below and the panels' useQuery share identical inputs.
  const { week, today } = getPanelRanges();
  const helpers = await getSsrHelpers();

  if (user.role === "STUDENT") {
    await Promise.all([
      helpers.class.list.prefetch(week),
      helpers.enrollment.listByStudent.prefetch({ time: "current" }),
      helpers.enrollment.studentStats.prefetch(),
    ]);
    return (
      <HydrationBoundary state={dehydrateSsr(helpers)}>
        <StudentHome userId={user.id} weekRange={week} />
      </HydrationBoundary>
    );
  }

  if (user.role === "INSTRUCTOR") {
    await Promise.all([
      helpers.class.list.prefetch(today),
      helpers.class.list.prefetch(week),
    ]);
    return (
      <HydrationBoundary state={dehydrateSsr(helpers)}>
        <InstructorHome userId={user.id} todayRange={today} weekRange={week} />
      </HydrationBoundary>
    );
  }

  // ADMIN / SECRETARY
  await Promise.all([
    helpers.class.list.prefetch(week),
    helpers.user.countByRole.prefetch({ role: "STUDENT", status: "ACTIVE" }),
  ]);
  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <DashboardView userName={user.name} userRole={user.role} weekRange={week} />
    </HydrationBoundary>
  );
}
