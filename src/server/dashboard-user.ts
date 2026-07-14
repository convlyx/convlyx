import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";

export type DashboardUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SECRETARY" | "INSTRUCTOR" | "STUDENT";
  tenantId: string;
  schoolId: string;
  tenant: { name: string };
  school: { name: string; subdomain: string; timeZone: string };
};

async function loadDashboardUser(): Promise<DashboardUser | null> {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  // The dashboard is only served on a tenant subdomain. Middleware sets
  // `x-tenant-subdomain` for page requests; the tenant + the caller's role
  // come from their Membership in that tenant.
  const headersList = await headers();
  const subdomain = headersList.get("x-tenant-subdomain");
  if (!subdomain) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const school = await db.school.findUnique({
        where: { subdomain },
        select: {
          id: true,
          tenantId: true,
          name: true,
          timeZone: true,
          tenant: { select: { name: true, status: true } },
        },
      });
      if (!school) return null;

      const membership = await db.membership.findFirst({
        where: { userId: authUser.id, tenantId: school.tenantId },
        select: {
          role: true,
          status: true,
          schoolId: true,
          user: { select: { name: true, email: true } },
        },
      });

      // No membership here (or deactivated in this tenant) ⇒ not a member of
      // this school. Sign out so middleware doesn't bounce /login → / → /login
      // forever. Auth cookies are per-host, so this doesn't touch a session the
      // person may hold on another school's subdomain.
      if (!membership || membership.status !== "ACTIVE") {
        await supabase.auth.signOut();
        return null;
      }

      if (school.tenant.status !== "ACTIVE") {
        // Tenant suspended by a platform operator — no dashboard access.
        await supabase.auth.signOut();
        return null;
      }

      return {
        id: authUser.id,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        tenantId: school.tenantId,
        schoolId: membership.schoolId,
        tenant: { name: school.tenant.name },
        school: { name: school.name, subdomain, timeZone: school.timeZone },
      };
    } catch (error) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      logger.error("dashboard-user: DB query failed", { error });
      return null;
    }
  }
  return null;
}

/**
 * Resolve the current dashboard user once per request. Both the (dashboard)
 * layout and individual pages call this; React.cache() deduplicates the
 * auth + DB roundtrip so we don't pay for it twice per navigation.
 */
export const getDashboardUser = cache(loadDashboardUser);

/**
 * Page-level guard: ensures a user is signed in and (optionally) holds one of
 * the allowed roles. Redirects to /login or / when the check fails. Pages
 * should prefer this over hand-rolling auth + role checks.
 */
export async function requireDashboardUser(
  allowedRoles?: ReadonlyArray<DashboardUser["role"]>,
): Promise<DashboardUser> {
  const user = await getDashboardUser();
  if (!user) redirect("/login");

  // Tenant/subdomain integrity is already enforced by getDashboardUser: it
  // resolves the tenant from the subdomain and requires an active Membership
  // there, signing out otherwise. So here we only need the role check.
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/");
  }
  return user;
}
