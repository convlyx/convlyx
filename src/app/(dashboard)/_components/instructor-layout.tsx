import { Sidebar } from "./sidebar";
import { InstructorTopBar } from "./instructor-top-bar";
import { MobileTabBar } from "./mobile-tab-bar";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Instructor shell — responsive, children rendered once:
 *  - desktop (md+): the same sidebar backoffice as admin/secretary
 *  - mobile: a curved top bar + floating bottom tab bar (the student shell)
 * A single InstructorTopBar carries the (one) NotificationBell across both
 * viewports — two header instances would double-subscribe to realtime. Only
 * the chrome toggles via CSS, so client components in `children` mount once.
 */
export function InstructorLayout({
  children,
  userId,
  userName,
  userRole,
  tenantName,
  schoolName,
}: {
  children: React.ReactNode;
  userId: string;
  userName: string;
  userRole: UserRole;
  tenantName: string;
  schoolName: string;
}) {
  return (
    <div className="flex h-screen">
      {/* Desktop sidebar (already hidden below md) */}
      <Sidebar userRole={userRole} tenantName={schoolName} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <InstructorTopBar
          userId={userId}
          userName={userName}
          userRole={userRole}
          tenantName={tenantName}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 pt-4 pb-28 md:p-6 md:pb-6 space-y-4">{children}</div>
        </main>

        {/* Mobile bottom tabs */}
        <MobileTabBar userRole={userRole} className="md:hidden" />
      </div>
    </div>
  );
}
