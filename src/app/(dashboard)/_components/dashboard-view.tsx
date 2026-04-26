"use client";

import { useMemo } from "react";
import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { typeKeys, classTypeColorMap } from "@/lib/constants/class";
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
}: {
  userName: string;
  userRole: UserRole;
}) {
  const t = useTranslations();
  const format = useFormatter();

  // Memoize the date range so it doesn't change on every render
  const dateRange = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return { from: now.toISOString(), to: weekFromNow.toISOString() };
  }, []);

  const { data: upcomingClasses, isLoading } = trpc.class.list.useQuery(dateRange);

  const { data: students } = trpc.user.list.useQuery(
    { role: "STUDENT" },
    { enabled: userRole === "ADMIN" || userRole === "SECRETARY" }
  );
  const activeStudentCount = students?.filter((s) => s.status === "ACTIVE").length ?? 0;

  const { data: enrollments } = trpc.enrollment.listByStudent.useQuery(
    undefined,
    { enabled: userRole === "STUDENT" }
  );

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayClasses = upcomingClasses?.filter((c) => {
    const classDate = new Date(c.startsAt as unknown as string);
    return classDate >= startOfToday && classDate <= today;
  }) ?? [];

  const scheduledToday = todayClasses.filter((c) => c.status === "SCHEDULED").length;
  const inProgressCount = todayClasses.filter((c) => c.status === "IN_PROGRESS").length;
  const activeEnrollments = enrollments?.filter((e) => e.status === "ENROLLED").length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {t("dashboard.welcome")}, {userName}
      </h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(userRole === "ADMIN" || userRole === "SECRETARY") && (
          <>
            <StatCard
              icon={CalendarDays}
              label={t("classes.scheduled")}
              value={scheduledToday}
              description={t("dashboard.today")}
            />
            <StatCard
              icon={Clock}
              label={t("classes.inProgress")}
              value={inProgressCount}
              description={t("dashboard.today")}
            />
            <StatCard
              icon={Users}
              label={t("dashboard.activeStudents")}
              value={activeStudentCount}
            />
          </>
        )}
        {userRole === "INSTRUCTOR" && (
          <>
            <StatCard
              icon={CalendarDays}
              label={t("classes.scheduled")}
              value={scheduledToday}
              description={t("dashboard.today")}
            />
            <StatCard
              icon={Clock}
              label={t("classes.inProgress")}
              value={inProgressCount}
              description={t("dashboard.today")}
            />
          </>
        )}
        {userRole === "STUDENT" && (
          <>
            <StatCard
              icon={BookCheck}
              label={t("enrollment.enrolled")}
              value={activeEnrollments}
              description={t("dashboard.activeEnrollments")}
            />
            <StatCard
              icon={CalendarDays}
              label={t("classes.scheduled")}
              value={scheduledToday}
              description={t("dashboard.availableThisWeek")}
            />
          </>
        )}
      </div>

      {/* Upcoming classes list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("dashboard.upcomingClasses")}</h2>
        {isLoading ? (
          <Loading />
        ) : !upcomingClasses || upcomingClasses.length === 0 ? (
          <EmptyState icon={BookOpen} message={t("common.noResults")} />
        ) : (
          <div className="grid gap-3">
            {upcomingClasses.slice(0, 10).map((cls) => (
              <Link
                key={cls.id}
                href={`/classes/${cls.id}`}
                className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover hover:border-primary/20 transition-all block group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${classTypeColorMap[cls.classType]}`}>
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium group-hover:text-primary transition-colors">{cls.title}</p>
                        <Badge variant="secondary">{t(typeKeys[cls.classType])}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />{cls.instructor.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {format.dateTime(new Date(cls.startsAt), {
                            weekday: "short", day: "2-digit", month: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          })}
                          {" · "}
                          {format.dateTime(new Date(cls.endsAt), {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />{cls._count.enrollments}/{cls.capacity}
                        </span>
                      </div>
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
