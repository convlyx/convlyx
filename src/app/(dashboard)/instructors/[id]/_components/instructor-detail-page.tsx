"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const t = useTranslations();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link href="/instructors" className="inline-flex">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </Link>

      <InstructorHeaderSection id={id} userRole={userRole} />
      <InstructorStatsSection id={id} />
      <InstructorHistorySection id={id} />
      <InstructorDangerZoneSection id={id} userRole={userRole} />
    </div>
  );
}
