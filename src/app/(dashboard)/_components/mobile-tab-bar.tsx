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
        className="pointer-events-auto mx-auto flex max-w-md items-stretch gap-1 rounded-2xl bg-card p-2 ring-1 ring-border/60"
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
                // Equal-width slots (flex-1) keep tab spacing and the active
                // pill's margins symmetric at every screen width. rounded-lg +
                // the card's p-2 inset keeps the pill safely inside the card's
                // rounded-2xl corners without clipping (see corner geometry).
                "flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-center transition-colors",
                isActive ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.5px]")} />
              <span className="max-w-full truncate text-[10px] font-medium leading-tight">
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
