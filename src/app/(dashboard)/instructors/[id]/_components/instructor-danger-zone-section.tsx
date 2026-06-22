"use client";

import { trpc } from "@/lib/trpc";
import { DangerZoneSection } from "@/app/(dashboard)/_components/danger-zone-section";
import type { UserRole } from "@/generated/prisma/enums";

export function InstructorDangerZoneSection({
  id,
  userRole,
}: {
  id: string;
  userRole: UserRole;
}) {
  const utils = trpc.useUtils();
  // Same query key as the header section — TanStack dedupes to one call.
  const { data: instructor } = trpc.user.instructorHeader.useQuery({ id });

  return (
    <DangerZoneSection
      id={id}
      canDelete={userRole === "ADMIN"}
      anonymized={instructor?.anonymized}
      deletable={instructor?.deletable}
      listPath="/instructors"
      onAnonymized={() => utils.user.instructorHeader.invalidate({ id })}
    />
  );
}
