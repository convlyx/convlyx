"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, CalendarDays, BookOpen, ClipboardList, GraduationCap, User } from "lucide-react";
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
  { key: "students", href: "/students", icon: GraduationCap, roles: ["INSTRUCTOR"] },
  { key: "enrollments", href: "/enrollments", icon: ClipboardList, roles: ["STUDENT"] },
  { key: "settings", href: "/settings", icon: User, roles: ["STUDENT", "INSTRUCTOR"] },
];

/** Floating bottom tab bar for the mobile shell. */
export function MobileTabBar({ userRole, className }: { userRole: UserRole; className?: string }) {
  const t = useTranslations();
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const activePath = pendingPath ?? pathname;
  const visibleTabs = tabs.filter((tab) => tab.roles.includes(userRole));

  return (
    <nav
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4", className)}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div
        className="pointer-events-auto mx-auto flex max-w-md items-center justify-around overflow-hidden rounded-2xl bg-card px-2 py-1.5 ring-1 ring-border/60"
        style={{ boxShadow: "0 14px 34px -14px color-mix(in oklch, var(--primary) 55%, black)" }}
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.href === "/" ? activePath === "/" : activePath.startsWith(tab.href);

          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={() => setPendingPath(tab.href)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3.5 py-2 transition-colors",
                isActive ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className="text-[10px] font-medium leading-tight">
                {tab.key === "settings"
                  ? t("common.profile")
                  : tab.key === "enrollments"
                    ? t("enrollments.enrollmentsShort")
                    : tNav(tab.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
