"use client";

import { trpc } from "@/lib/trpc";
import { DangerZoneSection } from "@/app/(dashboard)/_components/danger-zone-section";
import type { UserRole } from "@/generated/prisma/enums";

export function StudentDangerZoneSection({
  id,
  userRole,
}: {
  id: string;
  userRole: UserRole;
}) {
  const utils = trpc.useUtils();
  // Same query key as the header section — TanStack dedupes to one call.
  const { data: student } = trpc.user.studentHeader.useQuery({ id });

  return (
    <DangerZoneSection
      id={id}
      canDelete={userRole === "ADMIN"}
      anonymized={student?.anonymized}
      deletable={student?.deletable}
      listPath="/students"
      onAnonymized={() => {
        utils.user.studentHeader.invalidate({ id });
        utils.user.studentOverview.invalidate({ id });
      }}
    />
  );
}
