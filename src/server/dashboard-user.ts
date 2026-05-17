import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";

export type DashboardUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SECRETARY" | "INSTRUCTOR" | "STUDENT";
  tenantId: string;
  schoolId: string;
  tenant: { name: string };
  school: { name: string; subdomain: string };
};

async function loadDashboardUser(): Promise<DashboardUser | null> {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const user = await db.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          schoolId: true,
          tenant: { select: { name: true } },
          school: { select: { name: true, subdomain: true } },
        },
      });
      if (!user) {
        // Auth session valid but no User row — sign out so middleware doesn't loop.
        await supabase.auth.signOut();
        return null;
      }
      return user;
    } catch (error) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      console.error("[dashboard-user] DB query failed:", error);
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

  // Tenant-subdomain mismatch is a session/tenant integrity issue — same
  // resolution as in the layout: sign out and bounce to login.
  const headersList = await headers();
  const subdomain = headersList.get("x-tenant-subdomain");
  if (subdomain && user.school.subdomain !== subdomain) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/");
  }
  return user;
}
