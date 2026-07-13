import { db } from "@/server/db";
import { PlatformDashboard } from "../_components/platform-dashboard";

// Cross-tenant live data — never static-render at build time, otherwise the
// build hits the DB with whatever DATABASE_URL Vercel has cached and fails
// when credentials drift.
export const dynamic = "force-dynamic";

// Create/manage surface (tenant/school/admin dialogs). The landing page is now
// the insights overview; this keeps the create flows reachable until the ops
// sub-project formalizes them as adminProcedure mutations.
export default async function PlatformManagePage() {
  const [tenants, schools, userCount, classCount, enrollmentCount] = await Promise.all([
    db.tenant.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { schools: true, memberships: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.school.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        address: true,
        phone: true,
        tenantId: true,
        tenant: { select: { name: true } },
        _count: { select: { memberships: true, sessions: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.user.count(),
    db.classSession.count(),
    db.enrollment.count(),
  ]);

  return (
    <PlatformDashboard
      tenants={tenants}
      schools={schools}
      stats={{ users: userCount, classes: classCount, enrollments: enrollmentCount }}
    />
  );
}
