import { Suspense } from "react";
import { requireDashboardUser } from "@/server/dashboard-user";
import { Sidebar } from "./_components/sidebar";
import { MobileNav } from "./_components/mobile-nav";
import { Header } from "./_components/header";
import { MobileLayout } from "./_components/mobile-layout";
import { InstructorLayout } from "./_components/instructor-layout";
import { PageTitle } from "@/components/page-title";
import { AnalyticsIdentifier } from "@/components/analytics-identifier";
import { PostHogInit, PostHogPageviews } from "@/components/posthog-provider";
import { ConsentGate } from "./_components/consent-gate";


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireDashboardUser();

  const pageTitle = `${user.school.name} | Convlyx`;

  const analyticsProps = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    schoolId: user.schoolId,
  };

  const content = (
    <>
      <PageTitle title={pageTitle} />
      <AnalyticsIdentifier {...analyticsProps} />
      <ConsentGate />
      <PostHogInit />
      <Suspense fallback={null}>
        <PostHogPageviews />
      </Suspense>
      {children}
    </>
  );

  // Students get the mobile-first shell on every viewport.
  if (user.role === "STUDENT") {
    return (
      <MobileLayout
        userId={user.id}
        userName={user.name}
        userRole={user.role}
      >
        {content}
      </MobileLayout>
    );
  }

  // Instructors: backoffice (sidebar) on desktop, mobile shell on phones.
  if (user.role === "INSTRUCTOR") {
    return (
      <InstructorLayout
        userId={user.id}
        userName={user.name}
        userRole={user.role}
        tenantName={user.tenant.name}
        schoolName={user.school.name}
      >
        {content}
      </InstructorLayout>
    );
  }

  // Admin and Secretary get the backoffice layout
  return (
    <div className="flex h-screen">
      <PageTitle title={pageTitle} />
      <Sidebar userRole={user.role} tenantName={user.school.name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userId={user.id}
          userName={user.name}
          userRole={user.role}
          userMobileNav={<MobileNav userRole={user.role} tenantName={user.school.name} />}
          tenantName={user.tenant.name}
          schoolName={user.school.name}
        />
        {/* Padding lives on an inner wrapper, not the scroll container, so
            `position: sticky; top: 0` descendants (e.g. the calendar's date
            header) pin flush to the visible top instead of below the padding.
            Mirrors InstructorLayout / MobileLayout. */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 md:p-6 space-y-4">
            <AnalyticsIdentifier {...analyticsProps} />
            <ConsentGate />
            <PostHogInit />
            <Suspense fallback={null}>
              <PostHogPageviews />
            </Suspense>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
