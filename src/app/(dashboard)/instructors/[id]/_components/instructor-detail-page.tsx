"use client";

import { DetailBackLink } from "@/app/(dashboard)/_components/detail-back-link";
import { InstructorHeaderSection } from "./instructor-header-section";
import { InstructorStatsSection } from "./instructor-stats-section";
import { InstructorHistorySection } from "./instructor-history-section";
import { InstructorDangerZoneSection } from "./instructor-danger-zone-section";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Orchestrator — each child section owns its own tRPC query and skeleton
 * so they progressively reveal as data arrives instead of blocking on
 * one monolithic profile fetch. Header and danger zone share the same
 * studentHeader cache key so there's still one network call per endpoint.
 */
export function InstructorDetailPage({
  id,
  userRole,
}: {
  id: string;
  userRole: UserRole;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <DetailBackLink href="/instructors" />

      <InstructorHeaderSection id={id} userRole={userRole} />
      <InstructorStatsSection id={id} />
      <InstructorHistorySection id={id} />
      <InstructorDangerZoneSection id={id} userRole={userRole} />
    </div>
  );
}
