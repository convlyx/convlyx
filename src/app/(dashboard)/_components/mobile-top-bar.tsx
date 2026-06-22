"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations, useNow, useTimeZone } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { hourInTimeZone } from "@/lib/dates";
import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { NovidadesButton } from "@/components/novidades-button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Curved top bar for the mobile shell — time-aware greeting on the dashboard,
 * the screen title elsewhere, plus novidades / notifications / logout.
 */
export function MobileTopBar({
  userId,
  userName,
  userRole,
  className,
}: {
  userId: string;
  userName: string;
  userRole: UserRole;
  className?: string;
}) {
  const t = useTranslations();
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  // Shared "now" + school timezone (both inherited from the server, see
  // i18n.ts) so the greeting matches on SSR and hydration. `Date#getHours()`
  // would use the server's UTC/Dublin clock and mismatch the user's browser.
  const now = useNow({ updateInterval: 60_000 });
  const timeZone = useTimeZone() ?? "Europe/Lisbon";

  const firstName = userName.split(" ")[0];

  function greeting() {
    const hour = hourInTimeZone(now, timeZone);
    if (hour < 12) return t("dashboard.greeting.morning");
    if (hour < 18) return t("dashboard.greeting.afternoon");
    return t("dashboard.greeting.evening");
  }
  function knownTitle(): string | null {
    if (pathname.startsWith("/calendar")) return tNav("calendar");
    if (pathname.startsWith("/classes")) return tNav("classes");
    if (pathname.startsWith("/students")) return tNav("students");
    if (pathname.startsWith("/enrollments")) return t("enrollments.enrollmentsShort");
    if (pathname.startsWith("/settings")) return t("common.profile");
    return null;
  }
  // Default to the greeting on the home and any unmatched route, so a transient
  // route change never flashes a fallback title (previously the school name).
  const title = pathname === "/" ? null : knownTitle();

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
      className={cn("shrink-0 border-b bg-card px-4 pb-3", className)}
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0 flex-1">
          {title ? (
            <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{greeting()}</p>
              <h1 className="text-2xl font-bold leading-tight">{firstName} 👋</h1>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <NovidadesButton userRole={userRole} />
          <NotificationBell userId={userId} />
          <button
            type="button"
            onClick={handleLogout}
            aria-label={t("auth.logout")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
