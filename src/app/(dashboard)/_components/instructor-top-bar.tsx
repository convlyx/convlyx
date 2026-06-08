"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { NovidadesButton } from "@/components/novidades-button";
import { UserAvatar } from "@/components/user-avatar";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Single responsive top bar for the instructor shell. One header, one
 * NotificationBell — rendering the bell twice (a desktop header + a mobile
 * header) would mount two realtime subscriptions to the same channel and throw
 * "cannot add callbacks after subscribe()". Mobile shows a greeting/title;
 * desktop shows the avatar/name, matching the admin backoffice header.
 */
export function InstructorTopBar({
  userId,
  userName,
  userRole,
  tenantName,
}: {
  userId: string;
  userName: string;
  userRole: UserRole;
  tenantName: string;
}) {
  const t = useTranslations();
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  const firstName = userName.split(" ")[0];
  const isDashboard = pathname === "/";

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greeting.morning");
    if (hour < 18) return t("dashboard.greeting.afternoon");
    return t("dashboard.greeting.evening");
  }
  function screenTitle() {
    if (pathname.startsWith("/calendar")) return tNav("calendar");
    if (pathname.startsWith("/classes")) return tNav("classes");
    if (pathname.startsWith("/students")) return tNav("students");
    if (pathname.startsWith("/settings")) return t("common.profile");
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
    <header
      className="shrink-0 border-b bg-card px-4 pb-3 md:h-14 md:px-6 md:pb-0"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="flex w-full items-start justify-between gap-3 pt-1 md:h-full md:items-center md:pt-0">
        {/* Mobile: greeting / screen title. Desktop: sidebar carries the brand. */}
        <div className="min-w-0 flex-1 md:hidden">
          {isDashboard ? (
            <>
              <p className="text-sm text-muted-foreground">{greeting()}</p>
              <h1 className="text-2xl font-bold leading-tight">{firstName} 👋</h1>
            </>
          ) : (
            <h1 className="text-2xl font-bold leading-tight">{screenTitle()}</h1>
          )}
        </div>
        <div className="hidden flex-1 md:block" />

        {/* Single actions cluster — one NotificationBell instance. */}
        <div className="flex shrink-0 items-center gap-1 md:gap-3">
          <NovidadesButton userRole={userRole} />
          <NotificationBell userId={userId} />
          <div className="hidden items-center gap-3 md:flex">
            <UserAvatar
              name={userName}
              className="h-8 w-8 bg-primary text-primary-foreground text-xs font-bold"
            />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{userName}</p>
              <p className="text-xs text-muted-foreground">{t(`roles.${userRole}`)}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title={t("auth.logout")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8"
          >
            <LogOut className="h-[18px] w-[18px] md:h-4 md:w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
