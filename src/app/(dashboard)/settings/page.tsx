import { requireDashboardUser } from "@/server/dashboard-user";
import { db } from "@/server/db";
import { SettingsForm } from "./_components/settings-form";

export default async function SettingsPage() {
  const dashUser = await requireDashboardUser();

  // requireDashboardUser already returned the cached user; we re-query here
  // because settings needs the heavier school + tenant detail that the cached
  // payload omits.
  const detail = await db.user.findUnique({
    where: { id: dashUser.id },
    select: {
      school: {
        select: {
          id: true,
          name: true,
          subdomain: true,
          address: true,
          phone: true,
          cancellationNoticeHours: true,
          practicalSelfEnrollEnabled: true,
          _count: { select: { users: true, sessions: true } },
        },
      },
      tenant: { select: { id: true, name: true } },
    },
  });

  if (!detail) return null;

  return (
    <SettingsForm
      user={{
        id: dashUser.id,
        name: dashUser.name,
        email: dashUser.email,
        role: dashUser.role,
      }}
      school={{
        id: detail.school.id,
        name: detail.school.name,
        subdomain: detail.school.subdomain,
        address: detail.school.address ?? "",
        phone: detail.school.phone ?? "",
        cancellationNoticeHours: detail.school.cancellationNoticeHours,
        practicalSelfEnrollEnabled: detail.school.practicalSelfEnrollEnabled,
        userCount: detail.school._count.users,
        classCount: detail.school._count.sessions,
      }}
      tenant={{
        id: detail.tenant.id,
        name: detail.tenant.name,
      }}
    />
  );
}
