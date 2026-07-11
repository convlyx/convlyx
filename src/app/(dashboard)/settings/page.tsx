import { requireDashboardUser } from "@/server/dashboard-user";
import { db } from "@/server/db";
import { SettingsForm } from "./_components/settings-form";

export default async function SettingsPage() {
  const dashUser = await requireDashboardUser();

  // requireDashboardUser resolved the current tenant/school; fetch the heavier
  // school + tenant detail directly by the caller's (per-tenant) schoolId. The
  // member count comes from memberships (users may belong to several schools).
  const detail = await db.school.findUnique({
    where: { id: dashUser.schoolId },
    select: {
      id: true,
      name: true,
      subdomain: true,
      address: true,
      phone: true,
      cancellationNoticeHours: true,
      practicalSelfEnrollEnabled: true,
      _count: { select: { memberships: true, sessions: true } },
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
        id: detail.id,
        name: detail.name,
        subdomain: detail.subdomain,
        address: detail.address ?? "",
        phone: detail.phone ?? "",
        cancellationNoticeHours: detail.cancellationNoticeHours,
        practicalSelfEnrollEnabled: detail.practicalSelfEnrollEnabled,
        userCount: detail._count.memberships,
        classCount: detail._count.sessions,
      }}
      tenant={{
        id: detail.tenant.id,
        name: detail.tenant.name,
      }}
    />
  );
}
