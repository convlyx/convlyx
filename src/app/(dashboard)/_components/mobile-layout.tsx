"use client";

import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
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
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const activePath = pendingPath ?? pathname;

  const visibleTabs = tabs.filter((tab) => tab.roles.includes(userRole));

  // The curved header shows a time-aware greeting on the dashboard and the
  // screen title elsewhere (titles are suppressed in those pages' content for
  // the mobile-shell roles so they're not duplicated).
  const firstName = userName.split(" ")[0];
  const isDashboard = activePath === "/";
  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greeting.morning");
    if (hour < 18) return t("dashboard.greeting.afternoon");
    return t("dashboard.greeting.evening");
  }
  function screenTitle() {
    if (activePath.startsWith("/calendar")) return tNav("calendar");
    if (activePath.startsWith("/classes")) return tNav("classes");
    if (activePath.startsWith("/enrollments")) return t("enrollments.enrollmentsShort");
    if (activePath.startsWith("/settings")) return t("common.profile");
    return tenantName;
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    const { resetAnalytics } = await import("@/lib/posthog");
    resetAnalytics();
    const Sentry = await import("@sentry/nextjs");
    Sentry.setUser(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar — white, per-screen title / greeting + bell + logout */}
      <header
        className="shrink-0 border-b bg-card px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="min-w-0 flex-1">
            {isDashboard ? (
              <>
                <p className="text-sm text-muted-foreground">{greeting()}</p>
                <h1 className="text-2xl font-bold leading-tight">{firstName} 👋</h1>
              </>
            ) : (
              <h1 className="text-2xl font-bold leading-tight">{screenTitle()}</h1>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell userId={userId} />
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 pt-4 pb-28">
          {children}
        </div>
      </main>

      {/* Bottom tab bar — floating pill */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div
          className="pointer-events-auto mx-auto flex max-w-md items-center justify-around rounded-full bg-card px-2 py-1.5 ring-1 ring-border/60"
          style={{ boxShadow: "0 14px 34px -14px color-mix(in oklch, var(--primary) 55%, black)" }}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              tab.href === "/"
                ? activePath === "/"
                : activePath.startsWith(tab.href);

            return (
              <Link
                key={tab.key}
                href={tab.href}
                onClick={() => setPendingPath(tab.href)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-full px-3.5 py-2 transition-colors",
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
                <span className="text-[10px] font-medium leading-tight">
                  {tab.key === "settings" ? t("common.profile") : tab.key === "enrollments" ? t("enrollments.enrollmentsShort") : tNav(tab.key)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
