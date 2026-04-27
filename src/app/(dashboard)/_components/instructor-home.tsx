"use client";

import { useMemo } from "react";
import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  BookOpen,
  Users,
  ChevronRight,
  CheckCircle,
  Timer,
  Coffee,
} from "lucide-react";
import { typeKeys, statusKeys, statusVariant, classTypeColorMap, classTypeBadgeClass } from "@/lib/constants/class";

export function InstructorHome({ userName }: { userName: string }) {
  const t = useTranslations();
  const format = useFormatter();

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greeting.morning");
    if (hour < 18) return t("dashboard.greeting.afternoon");
    return t("dashboard.greeting.evening");
  }

  const todayRange = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return { from: startOfDay.toISOString(), to: endOfDay.toISOString() };
  }, []);

  const weekRange = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return { from: now.toISOString(), to: weekFromNow.toISOString() };
  }, []);

  const { data: todayClasses, isLoading: todayLoading } = trpc.class.list.useQuery(todayRange);
  const { data: weekClasses, isLoading: weekLoading } = trpc.class.list.useQuery(weekRange);

  const isLoading = todayLoading || weekLoading;
  if (isLoading) return <Loading />;

  const firstName = userName.split(" ")[0];
  const now = new Date();

  const currentOrNextClass = todayClasses?.find(
    (cls) => cls.status === "IN_PROGRESS" || (cls.status === "SCHEDULED" && new Date(cls.startsAt) > now)
  );

  const completedToday = todayClasses?.filter((cls) => cls.status === "COMPLETED").length ?? 0;
  const remainingToday = todayClasses?.filter((cls) => cls.status === "SCHEDULED").length ?? 0;
  const totalToday = todayClasses?.length ?? 0;
  const totalStudentsToday = todayClasses?.reduce((acc, cls) => acc + cls._count.enrollments, 0) ?? 0;

  // Progress percentage for today
  const progressPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <p className="text-sm text-muted-foreground">{getGreeting()}</p>
        <h1 className="text-2xl font-bold">{firstName} 👋</h1>
      </div>

      {/* Hero — current/next class */}
      {currentOrNextClass ? (
        <div className={`relative overflow-hidden rounded-2xl p-5 text-white ${
          currentOrNextClass.status === "IN_PROGRESS"
            ? "bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700"
            : "bg-gradient-to-br from-primary via-primary to-primary/80"
        }`}>
          {/* Decorative */}
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/5" />

          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-medium opacity-80 uppercase tracking-wide">
              {currentOrNextClass.status === "IN_PROGRESS" ? (
                <>
                  <span className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
                  {t("dashboard.inProgress")}
                </>
              ) : (
                <>
                  <Timer className="h-3.5 w-3.5" />
                  {t("dashboard.nextClass")}
                </>
              )}
            </div>
            <h2 className="text-xl font-bold mt-2">{currentOrNextClass.title}</h2>
            <div className="flex items-center gap-4 mt-3 text-sm opacity-90">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {format.dateTime(new Date(currentOrNextClass.startsAt), { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {format.dateTime(new Date(currentOrNextClass.endsAt), { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {currentOrNextClass._count.enrollments}/{currentOrNextClass.capacity}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                {t(typeKeys[currentOrNextClass.classType])}
              </Badge>
            </div>
          </div>
        </div>
      ) : totalToday > 0 && completedToday === totalToday ? (
        /* All done for today */
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-muted/50 p-6 text-center">
          <Coffee className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-base font-semibold">{t("dashboard.allClassesDone")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("dashboard.classCount", { count: completedToday })} · {totalStudentsToday} {t("dashboard.students")}</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 p-8 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("dashboard.noClassesToday")}</p>
        </div>
      )}

      {/* Today's progress */}
      {totalToday > 0 && (
        <div className="rounded-xl border bg-card p-4 card-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">{t("dashboard.todaysProgress")}</p>
            <span className="text-sm text-muted-foreground">{completedToday}/{totalToday}</span>
          </div>
          {/* Progress bar */}
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-lg font-bold">{completedToday}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("dashboard.completed")}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                <span className="text-lg font-bold">{remainingToday}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("dashboard.remaining")}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-lg font-bold">{totalStudentsToday}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("nav.students")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Today's schedule — timeline */}
      {todayClasses && todayClasses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{t("dashboard.todaySchedule")}</h2>
          <div className="space-y-2">
            {todayClasses.map((cls, index) => {
              const isPast = cls.status === "COMPLETED";
              const isCurrent = cls.status === "IN_PROGRESS";
              return (
                <div
                  key={cls.id}
                  className={`relative flex items-center gap-3 rounded-xl border p-3.5 transition-all ${
                    isCurrent
                      ? "border-primary bg-primary/5 card-shadow-hover"
                      : isPast
                      ? "opacity-50 bg-muted/30"
                      : "bg-card card-shadow hover:card-shadow-hover"
                  }`}
                >
                  {/* Time block */}
                  <div className="flex flex-col items-center text-center w-12 shrink-0">
                    <span className={`text-sm font-bold ${isCurrent ? "text-primary" : ""}`}>
                      {format.dateTime(new Date(cls.startsAt), { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format.dateTime(new Date(cls.endsAt), { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Dot connector */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`h-3 w-3 rounded-full border-2 ${
                      isCurrent
                        ? "border-primary bg-primary"
                        : isPast
                        ? "border-muted-foreground/30 bg-muted-foreground/30"
                        : "border-primary/50 bg-transparent"
                    }`} />
                    {index < todayClasses.length - 1 && (
                      <div className="w-px h-4 bg-border mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-semibold truncate ${isCurrent ? "text-primary" : ""}`}>{cls.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`text-[10px] px-1.5 py-0 ${classTypeBadgeClass[cls.classType]}`}>
                        {t(typeKeys[cls.classType])}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {cls._count.enrollments}/{cls.capacity} {t("dashboard.students")}
                      </span>
                      {isCurrent && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                          {t("dashboard.inProgressBadge")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* This week preview */}
      {weekClasses && weekClasses.filter((c) => c.status === "SCHEDULED").length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("dashboard.upcomingClasses")}</h2>
            <Link href="/calendar" className="text-sm text-primary font-medium flex items-center gap-0.5">
              {t("dashboard.calendarLink")} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {weekClasses.filter((cls) => cls.status === "SCHEDULED").slice(0, 4).map((cls) => (
              <div
                key={cls.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3.5 card-shadow hover:card-shadow-hover transition-all"
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${classTypeColorMap[cls.classType]}`}>
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{cls.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {format.dateTime(new Date(cls.startsAt), {
                        weekday: "short", day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <span>·</span>
                    <span>{cls._count.enrollments}/{cls.capacity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!todayClasses?.length && !weekClasses?.length && (
        <EmptyState icon={CalendarDays} message={t("dashboard.noClassesScheduled")} />
      )}
    </div>
  );
}
