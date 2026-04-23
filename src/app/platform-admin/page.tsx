import { db } from "@/server/db";
import { PlatformDashboard } from "./_components/platform-dashboard";

export default async function PlatformAdminPage() {
  const [tenants, schools, userCount, classCount, enrollmentCount] = await Promise.all([
    db.tenant.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { schools: true, users: true } },
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
        _count: { select: { users: true, sessions: true } },
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
