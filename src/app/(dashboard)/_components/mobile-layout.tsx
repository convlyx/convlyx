import { MobileTopBar } from "./mobile-top-bar";
import { MobileTabBar } from "./mobile-tab-bar";
import type { UserRole } from "@/generated/prisma/enums";

/** Mobile-first shell: curved top bar + scrollable content + floating tab bar. */
export function MobileLayout({
  children,
  userId,
  userName,
  userRole,
}: {
  children: React.ReactNode;
  userId: string;
  userName: string;
  userRole: UserRole;
}) {
  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileTopBar
        userId={userId}
        userName={userName}
        userRole={userRole}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 pt-4 pb-28">{children}</div>
      </main>
      <MobileTabBar userRole={userRole} />
    </div>
  );
}
