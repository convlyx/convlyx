"use client";

import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  Users,
  BookCheck,
  BookOpen,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";
import type { LucideIcon } from "lucide-react";

const typeKeys: Record<string, string> = {
  THEORY: "classes.theory",
  PRACTICAL: "classes.practical",
};

export function DashboardView({
  userName,
  userRole,
}: {
  userName: string;
  userRole: UserRole;
}) {
  const t = useTranslations();
  const format = useFormatter();

  // Upcoming classes for the next 7 days
  const now = new Date();
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const { data: upcomingClasses } = trpc.class.list.useQuery({
    from: now.toISOString(),
    to: weekFromNow.toISOString(),
  });

  const { data: enrollments } = trpc.enrollment.listByStudent.useQuery(
    undefined,
    { enabled: userRole === "STUDENT" }
  );

  const scheduledCount = upcomingClasses?.filter((c) => c.status === "SCHEDULED").length ?? 0;
  const inProgressCount = upcomingClasses?.filter((c) => c.status === "IN_PROGRESS").length ?? 0;
  const totalStudents = upcomingClasses?.reduce((acc, c) => acc + c._count.enrollments, 0) ?? 0;
  const activeEnrollments = enrollments?.filter((e) => e.status === "ENROLLED").length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {t("dashboard.welcome")}, {userName}
      </h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(userRole === "ADMIN" || userRole === "SECRETARY") && (
          <>
            <StatCard
              icon={CalendarDays}
              label={t("classes.scheduled")}
              value={scheduledCount}
              description={t("dashboard.next7Days")}
            />
            <StatCard
              icon={Clock}
              label={t("classes.inProgress")}
              value={inProgressCount}
              description={t("dashboard.happeningNow")}
            />
            <StatCard
              icon={Users}
              label={t("nav.students")}
              value={totalStudents}
              description={t("dashboard.activeEnrollments")}
            />
          </>
        )}
        {userRole === "INSTRUCTOR" && (
          <>
            <StatCard
              icon={CalendarDays}
              label={t("classes.scheduled")}
              value={scheduledCount}
              description={t("dashboard.next7Days")}
            />
            <StatCard
              icon={Clock}
              label={t("classes.inProgress")}
              value={inProgressCount}
              description={t("dashboard.happeningNow")}
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
              value={scheduledCount}
              description={t("dashboard.availableThisWeek")}
            />
          </>
        )}
      </div>

      {/* Upcoming classes list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("dashboard.upcomingClasses")}</h2>
        {!upcomingClasses || upcomingClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">{t("common.noResults")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingClasses.slice(0, 10).map((cls) => (
              <div
                key={cls.id}
                className={`flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 border-l-4 ${
                  cls.classType === "THEORY"
                    ? "border-l-blue-400"
                    : "border-l-emerald-500"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">
                    {t(typeKeys[cls.classType])}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{cls.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {cls.instructor.name} — {cls.school.name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    {format.dateTime(new Date(cls.startsAt), {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cls._count.enrollments}/{cls.capacity} {t("nav.students").toLowerCase()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
