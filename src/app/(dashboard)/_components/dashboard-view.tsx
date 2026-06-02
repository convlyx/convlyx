"use client";

import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { CardListSkeleton } from "@/components/skeletons/card-list-skeleton";
import { StatCardSkeleton } from "@/components/skeletons/stat-row-skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { typeKeys, classTypeColorMap, classTypeBadgeClass } from "@/lib/constants/class";
import {
  CalendarDays,
  Clock,
  Users,
  BookCheck,
  BookOpen,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";

export function DashboardView({
  userName,
  userRole,
  weekRange,
}: {
  userName: string;
  userRole: UserRole;
  weekRange: { from: string; to: string };
}) {
  const t = useTranslations();
  const format = useFormatter();

  const { data: upcomingData, isLoading } = trpc.class.list.useQuery(weekRange);
  const upcomingClasses = upcomingData?.items;

  // Head-count only — avoids fetching every student row (and the Supabase
  // auth-status merge) just to show a number, so this stat loads fast and
  // independently of the class list.
  const { data: studentsData, isLoading: studentsLoading } = trpc.user.countByRole.useQuery(
    { role: "STUDENT", status: "ACTIVE" },
    { enabled: userRole === "ADMIN" || userRole === "SECRETARY" }
  );
  const activeStudentCount = studentsData?.count ?? 0;

  const { data: enrollmentsData, isLoading: enrollmentsLoading } = trpc.enrollment.listByStudent.useQuery(
    undefined,
    { enabled: userRole === "STUDENT" }
  );
  const enrollments = enrollmentsData?.items;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayClasses = upcomingClasses?.filter((c) => {
    return c.startsAt >= startOfToday && c.startsAt <= today;
  }) ?? [];

  const scheduledToday = todayClasses.filter((c) => c.status === "SCHEDULED").length;
  const inProgressCount = todayClasses.filter((c) => c.status === "IN_PROGRESS").length;
  const activeEnrollments = enrollments?.filter((e) => e.status === "ENROLLED").length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {t("dashboard.welcome")}, {userName}
      </h1>

      {/* Stats cards — each appears as soon as its source query resolves */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(userRole === "ADMIN" || userRole === "SECRETARY") && (
          <>
            {isLoading ? <StatCardSkeleton /> : (
              <StatCard
                icon={CalendarDays}
                label={t("classes.scheduled")}
                value={scheduledToday}
                description={t("dashboard.today")}
              />
            )}
            {isLoading ? <StatCardSkeleton /> : (
              <StatCard
                icon={Clock}
                label={t("classes.inProgress")}
                value={inProgressCount}
                description={t("dashboard.today")}
              />
            )}
            {studentsLoading ? <StatCardSkeleton /> : (
              <StatCard
                icon={Users}
                label={t("dashboard.activeStudents")}
                value={activeStudentCount}
              />
            )}
          </>
        )}
        {userRole === "INSTRUCTOR" && (
          <>
            {isLoading ? <StatCardSkeleton /> : (
              <StatCard
                icon={CalendarDays}
                label={t("classes.scheduled")}
                value={scheduledToday}
                description={t("dashboard.today")}
              />
            )}
            {isLoading ? <StatCardSkeleton /> : (
              <StatCard
                icon={Clock}
                label={t("classes.inProgress")}
                value={inProgressCount}
                description={t("dashboard.today")}
              />
            )}
          </>
        )}
        {userRole === "STUDENT" && (
          <>
            {enrollmentsLoading ? <StatCardSkeleton /> : (
              <StatCard
                icon={BookCheck}
                label={t("enrollments.enrolled")}
                value={activeEnrollments}
                description={t("dashboard.activeEnrollments")}
              />
            )}
            {isLoading ? <StatCardSkeleton /> : (
              <StatCard
                icon={CalendarDays}
                label={t("classes.scheduled")}
                value={scheduledToday}
                description={t("dashboard.availableThisWeek")}
              />
            )}
          </>
        )}
      </div>

      {/* Upcoming classes list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("dashboard.upcomingClasses")}</h2>
        {isLoading ? (
          <CardListSkeleton rows={5} />
        ) : !upcomingClasses || upcomingClasses.length === 0 ? (
          <EmptyState icon={BookOpen} message={t("common.noResults")} />
        ) : (
          <div className="grid gap-3 animate-in fade-in duration-300">
            {upcomingClasses.slice(0, 10).map((cls) => (
              <Link
                key={cls.id}
                href={`/classes/${cls.id}`}
                className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover hover:border-primary/20 transition-all block group"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${classTypeColorMap[cls.classType]}`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium group-hover:text-primary transition-colors truncate min-w-0">{cls.title}</p>
                      <Badge className={classTypeBadgeClass[cls.classType]}>{t(typeKeys[cls.classType])}</Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1 truncate min-w-0">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{cls.instructor.name}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {format.dateTime(new Date(cls.startsAt), {
                          weekday: "short", day: "2-digit", month: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                        {" · "}
                        {format.dateTime(new Date(cls.endsAt), {
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="h-3.5 w-3.5 shrink-0" />{cls._count.enrollments}/{cls.capacity}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
