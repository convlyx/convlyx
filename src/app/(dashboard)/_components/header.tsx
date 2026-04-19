"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import type { UserRole } from "@/generated/prisma/enums";

type HeaderProps = {
  userId: string;
  userName: string;
  userRole: UserRole;
  tenantName: string;
  schoolName: string;
  userMobileNav: React.ReactNode;
};

export function Header({
  userId,
  userName,
  userRole,
  tenantName,
  schoolName,
  userMobileNav,
}: HeaderProps) {
  const t = useTranslations();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between px-3 md:px-6 shadow-[0_1px_3px_0_rgb(0_0_0/0.05)]">
      <div className="flex items-center gap-2">
        {/* Hamburger on mobile */}
        {userMobileNav}
        {/* Tenant / school breadcrumb — hide school on mobile */}
        <span className="text-sm font-semibold truncate">{tenantName}</span>
        <span className="text-muted-foreground hidden sm:inline">/</span>
        <span className="text-sm text-muted-foreground hidden sm:inline truncate">{schoolName}</span>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <NotificationBell userId={userId} />
        <UserAvatar name={userName} className="h-8 w-8 bg-primary text-primary-foreground text-xs font-bold" />
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-tight">{userName}</p>
          <p className="text-xs text-muted-foreground">
            {t(`roles.${userRole}`)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title={t("auth.logout")}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
