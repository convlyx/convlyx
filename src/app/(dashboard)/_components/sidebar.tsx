"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { UserRole } from "@/generated/prisma/enums";

type NavItem = {
  key: string;
  href: string;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  { key: "dashboard", href: "/", roles: ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"] },
  { key: "calendar", href: "/calendar", roles: ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"] },
  { key: "classes", href: "/classes", roles: ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"] },
  { key: "students", href: "/students", roles: ["ADMIN", "SECRETARY", "INSTRUCTOR"] },
  { key: "instructors", href: "/instructors", roles: ["ADMIN", "SECRETARY"] },
  { key: "schools", href: "/schools", roles: ["ADMIN"] },
  { key: "users", href: "/users", roles: ["ADMIN", "SECRETARY"] },
  { key: "settings", href: "/settings", roles: ["ADMIN"] },
];

export function Sidebar({ userRole }: { userRole: UserRole }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside className="flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="text-lg font-bold">
          Escola de Condução
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
