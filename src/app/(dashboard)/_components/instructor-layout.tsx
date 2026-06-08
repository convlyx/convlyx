import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileTopBar } from "./mobile-top-bar";
import { MobileTabBar } from "./mobile-tab-bar";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Instructor shell — responsive, children rendered once:
 *  - desktop (md+): the same sidebar + header backoffice as admin/secretary
 *  - mobile: the curved top bar + floating bottom tab bar (the student shell)
 * Only the chrome is toggled via CSS, so client components in `children`
 * mount a single time.
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
        {/* Desktop header */}
        <div className="hidden md:block">
          <Header
            userId={userId}
            userName={userName}
            userRole={userRole}
            userMobileNav={null}
            tenantName={tenantName}
            schoolName={schoolName}
          />
        </div>

        {/* Mobile top bar */}
        <MobileTopBar
          userId={userId}
          userName={userName}
          userRole={userRole}
          tenantName={schoolName}
          className="md:hidden"
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
