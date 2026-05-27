"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, BookCheck, XCircle, CalendarDays } from "lucide-react";

export function StudentStatsSection({ id }: { id: string }) {
  const t = useTranslations();
  const { data, isLoading } = trpc.user.studentOverview.useQuery({ id });

  if (isLoading || !data) {
    return <StudentStatsSkeleton />;
  }

  const { stats } = data;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={BookOpen} label={t("users.totalClasses")} value={stats.totalClasses} />
        <StatCard icon={CalendarDays} label={t("users.upcomingClasses")} value={stats.upcoming} />
        <StatCard icon={BookCheck} label={t("users.classesAttended")} value={stats.totalAttended} />
        <StatCard icon={XCircle} label={t("users.classesMissed")} value={stats.totalNoShow} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 card-shadow">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{t("users.theoryProgress")}</h3>
          <p className="text-3xl font-bold">{stats.theoryAttended}</p>
          <p className="text-xs text-muted-foreground">{t("users.classesAttended").toLowerCase()}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 card-shadow">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{t("users.practicalProgress")}</h3>
          <p className="text-3xl font-bold">{stats.practicalAttended}</p>
          <p className="text-xs text-muted-foreground">{t("users.classesAttended").toLowerCase()}</p>
        </div>
      </div>
    </>
  );
}

function StudentStatsSkeleton() {
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
