"use client";

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
  Building2,
  UserCog,
  Settings,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";
import type { LucideIcon } from "lucide-react";

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
  { key: "schools", href: "/schools", roles: ["ADMIN"], icon: Building2, section: "admin" },
  { key: "users", href: "/users", roles: ["ADMIN", "SECRETARY"], icon: UserCog, section: "admin" },
  { key: "settings", href: "/settings", roles: ["ADMIN"], icon: Settings, section: "admin" },
];

export function Sidebar({ userRole, tenantName }: { userRole: UserRole; tenantName: string }) {
  const t = useTranslations();
  const tNav = useTranslations("nav");
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const mainItems = visibleItems.filter((item) => item.section === "main");
  const adminItems = visibleItems.filter((item) => item.section === "admin");

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2">
          <img src="/favicon.png" alt="" width={28} height={28} className="shrink-0" />
          <span className="text-sm font-bold truncate">{tenantName}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {mainItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tNav(item.key)}
            </Link>
          );
        })}

        {adminItems.length > 0 && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tNav(item.key)}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
