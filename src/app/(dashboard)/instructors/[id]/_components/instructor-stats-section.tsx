"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, BookCheck, CalendarDays, Users } from "lucide-react";

export function InstructorStatsSection({ id }: { id: string }) {
  const t = useTranslations();
  const { data, isLoading } = trpc.user.instructorOverview.useQuery({ id });

  if (isLoading || !data) {
    return <InstructorStatsSkeleton />;
  }

  const { stats } = data;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label={t("users.upcomingClasses")} value={stats.upcomingClasses} />
        <StatCard icon={BookCheck} label={t("users.completedClasses")} value={stats.completedClasses} />
        <StatCard icon={BookOpen} label={t("users.totalClasses")} value={stats.totalClasses} />
        <StatCard icon={Users} label={t("users.studentsTaught")} value={stats.totalStudentsTaught} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 rounded-full bg-blue-400" />
            <h3 className="text-sm font-medium text-muted-foreground">{t("users.theoryProgress")}</h3>
          </div>
          <p className="text-3xl font-bold">{stats.theoryClasses}</p>
          <p className="text-xs text-muted-foreground">{t("classes.title").toLowerCase()}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <h3 className="text-sm font-medium text-muted-foreground">{t("users.practicalProgress")}</h3>
          </div>
          <p className="text-3xl font-bold">{stats.practicalClasses}</p>
          <p className="text-xs text-muted-foreground">{t("classes.title").toLowerCase()}</p>
        </div>
      </div>
    </>
  );
}

function InstructorStatsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 card-shadow space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 card-shadow space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </>
  );
}
