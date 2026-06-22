"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/generated/prisma/enums";
import { navItems } from "./sidebar";
import { NavLink } from "./nav-link";

export function MobileNav({ userRole, tenantName }: { userRole: UserRole; tenantName: string }) {
  const t = useTranslations();
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const mainItems = visibleItems.filter((item) => item.section === "main");
  const adminItems = visibleItems.filter((item) => item.section === "admin");

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(true)}
        aria-label={t("common.openMenu")}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setOpen(false)}
          />

          <aside className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-sidebar text-sidebar-foreground animate-in slide-in-from-left duration-200">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <Link
                href="/"
                className="flex items-center gap-2 min-w-0 flex-1 mr-2"
                onClick={() => setOpen(false)}
              >
                <img src="/favicon.png" alt="" width={28} height={28} className="shrink-0" />
                <span className="text-sm font-bold truncate">{tenantName}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground h-8 w-8"
                onClick={() => setOpen(false)}
                aria-label={t("common.closeMenu")}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
              {mainItems.map((item) => (
                <NavLink
                  key={item.key}
                  href={item.href}
                  icon={item.icon}
                  label={tNav(item.key)}
                  isActive={
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href)
                  }
                  onClick={() => setOpen(false)}
                  className="py-2.5"
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
                      isActive={pathname.startsWith(item.href)}
                      onClick={() => setOpen(false)}
                      className="py-2.5"
                    />
                  ))}
                </>
              )}
            </nav>
          </aside>
        </>
      )}
    </div>
  );
}
