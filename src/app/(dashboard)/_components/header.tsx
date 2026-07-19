"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { NovidadesButton } from "@/components/novidades-button";
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
  schoolName,
  userMobileNav,
}: HeaderProps) {
  const t = useTranslations();
  const router = useRouter();

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
    <header className="flex h-14 items-center justify-between gap-2 px-3 md:px-6 shadow-[0_1px_3px_0_rgb(0_0_0/0.05)]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Hamburger on mobile */}
        {userMobileNav}
        {/* Show school name on mobile only — sidebar shows it on desktop */}
        <span className="text-sm font-semibold truncate md:hidden">{schoolName}</span>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <NovidadesButton userRole={userRole} />
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
          aria-label={t("auth.logout")}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
