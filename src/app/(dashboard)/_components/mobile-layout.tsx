"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  CalendarDays,
  BookOpen,
  ClipboardList,
  User,
  LogOut,
  CheckSquare,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import type { UserRole } from "@/generated/prisma/enums";
import type { LucideIcon } from "lucide-react";

type TabItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
};

const tabs: TabItem[] = [
  { key: "dashboard", href: "/", icon: Home, roles: ["STUDENT", "INSTRUCTOR"] },
  { key: "calendar", href: "/calendar", icon: CalendarDays, roles: ["STUDENT", "INSTRUCTOR"] },
  { key: "classes", href: "/classes", icon: BookOpen, roles: ["STUDENT", "INSTRUCTOR"] },
  { key: "enrollments", href: "/enrollments", icon: ClipboardList, roles: ["STUDENT"] },
  { key: "settings", href: "/settings", icon: User, roles: ["STUDENT", "INSTRUCTOR"] },
];

export function MobileLayout({
  children,
  userId,
  userName,
  userRole,
  tenantName,
}: {
  children: React.ReactNode;
  userId: string;
  userName: string;
  userRole: UserRole;
  tenantName: string;
}) {
  const t = useTranslations();
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  const visibleTabs = tabs.filter((tab) => tab.roles.includes(userRole));

  useEffect(() => {
    document.title = `${tenantName} | Convlyx`;
  }, [tenantName]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar — minimal, clean */}
      <header className="flex items-center justify-between px-4 h-14 border-b bg-card shrink-0">
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="" width={28} height={28} className="shrink-0" />
          <div>
            <p className="text-sm font-semibold leading-tight truncate">{tenantName}</p>
            <p className="text-xs text-muted-foreground truncate">{userName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell userId={userId} />
          <button
            onClick={handleLogout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 pb-20">
          {children}
        </div>
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur-sm safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
                <span className="text-[10px] font-medium leading-tight">
                  {tab.key === "settings" ? t("common.profile") : tab.key === "enrollments" ? t("enrollment.enrollmentsShort") : tNav(tab.key)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
