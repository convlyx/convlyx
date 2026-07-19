"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Users,
  UserCog,
  Settings,
  BarChart3,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "./nav-link";

export type NavItem = {
  key: string;
  href: string;
  roles: UserRole[];
  icon: LucideIcon;
  section?: "main" | "admin";
};

export const navItems: NavItem[] = [
  { key: "dashboard", href: "/", roles: ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"], icon: LayoutDashboard, section: "main" },
  { key: "calendar", href: "/calendar", roles: ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"], icon: CalendarDays, section: "main" },
  { key: "classes", href: "/classes", roles: ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"], icon: BookOpen, section: "main" },
  { key: "enrollments", href: "/enrollments", roles: ["STUDENT"], icon: ClipboardList, section: "main" },
  { key: "students", href: "/students", roles: ["ADMIN", "SECRETARY", "INSTRUCTOR"], icon: GraduationCap, section: "main" },
  { key: "instructors", href: "/instructors", roles: ["ADMIN", "SECRETARY"], icon: Users, section: "main" },
  { key: "staff", href: "/staff", roles: ["ADMIN"], icon: UserCog, section: "admin" },
  { key: "analytics", href: "/analytics", roles: ["ADMIN"], icon: BarChart3, section: "admin" },
  { key: "settings", href: "/settings", roles: ["ADMIN", "SECRETARY"], icon: Settings, section: "admin" },
];

export function Sidebar({ userRole, tenantName }: { userRole: UserRole; tenantName: string }) {
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const activePath = pendingPath ?? pathname;

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const mainItems = visibleItems.filter((item) => item.section === "main");
  const adminItems = visibleItems.filter((item) => item.section === "admin");

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2 min-w-0 w-full">
          <img src="/favicon.png" alt="" width={28} height={28} className="shrink-0" />
          <span className="text-sm font-bold truncate">{tenantName}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {mainItems.map((item) => (
          <NavLink
            key={item.key}
            href={item.href}
            icon={item.icon}
            label={tNav(item.key)}
            isActive={
              item.href === "/"
                ? activePath === "/"
                : activePath.startsWith(item.href)
            }
            onClick={() => setPendingPath(item.href)}
          />
        ))}

        {adminItems.length > 0 && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            {adminItems.map((item) => (
              <NavLink
                key={item.key}
                href={item.href}
                icon={item.icon}
                label={tNav(item.key)}
                isActive={activePath.startsWith(item.href)}
                onClick={() => setPendingPath(item.href)}
              />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
