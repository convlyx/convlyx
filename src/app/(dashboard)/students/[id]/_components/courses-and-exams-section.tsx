"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryBadge } from "@/components/category-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GraduationCap, CalendarPlus, CheckCircle2, XCircle, FileText, MapPin, User as UserIcon, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { exportCourseProgressPDF } from "@/lib/pdf-export";
import { StartCourseDialog } from "./start-course-dialog";
import { ScheduleExamDialog } from "./schedule-exam-dialog";
import { RecordExamResultDialog } from "./record-exam-result-dialog";
import type { UserRole } from "@/generated/prisma/enums";
import type { RouterOutput } from "@/lib/trpc";

type OverviewCourse = RouterOutput["user"]["studentOverview"]["studentCourses"][number];

const RESULT_VARIANT: Record<OverviewCourse["exams"][number]["result"], "default" | "secondary" | "destructive" | "outline"> = {
  SCHEDULED: "secondary",
  PASSED: "default",
  FAILED: "destructive",
  NO_SHOW: "destructive",
  CANCELLED: "outline",
};

const RESULT_KEYS: Record<OverviewCourse["exams"][number]["result"], string> = {
  SCHEDULED: "exams.scheduledStatus",
  PASSED: "exams.passedStatus",
  FAILED: "exams.failedStatus",
  NO_SHOW: "exams.noShowStatus",
  CANCELLED: "exams.cancelledStatus",
};

const COURSE_STATUS_KEYS: Record<OverviewCourse["status"], string> = {
  IN_PROGRESS: "courses.statusInProgress",
  COMPLETED: "courses.statusCompleted",
  ABANDONED: "courses.statusAbandoned",
};

const COURSE_STATUS_VARIANT: Record<OverviewCourse["status"], "default" | "secondary" | "destructive" | "outline"> = {
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  ABANDONED: "outline",
};

export function CoursesAndExamsSection({
  studentId,
  userRole,
}: {
  studentId: string;
  userRole: UserRole;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();

  const [showStart, setShowStart] = useState(false);
  const [scheduleForCourse, setScheduleForCourse] = useState<OverviewCourse | null>(null);
  const [recordResultExamId, setRecordResultExamId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [abandonId, setAbandonId] = useState<string | null>(null);
  const [cancelExamId, setCancelExamId] = useState<string | null>(null);

  // Both queries are deduped via TanStack — we share them with the header
  // and stats sections without doing extra network work.
  const { data: header } = trpc.user.studentHeader.useQuery({ id: studentId });
  const { data: overview, isLoading } = trpc.user.studentOverview.useQuery({ id: studentId });

  const canManage = userRole === "ADMIN" || userRole === "SECRETARY";

  function invalidateCoursesPath() {
    utils.user.studentOverview.invalidate({ id: studentId });
  }

  const completeMutation = trpc.course.complete.useMutation({
    onSuccess: () => {
      toast.success(t("toast.courseCompleted"));
      invalidateCoursesPath();
      setCompleteId(null);
    },
    onError,
  });

  const abandonMutation = trpc.course.abandon.useMutation({
    onSuccess: (result) => {
      toast.success(t("toast.courseAbandoned", { count: result.cancelledCount }));
      invalidateCoursesPath();
      utils.user.studentEnrollments.invalidate({ id: studentId });
      utils.enrollment.listByStudent.invalidate();
      setAbandonId(null);
    },
    onError,
  });

  const cancelExamMutation = trpc.exam.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.examCancelled"));
      invalidateCoursesPath();
      utils.exam.list.invalidate();
      setCancelExamId(null);
    },
    onError,
  });

  if (isLoading || !overview) {
    return <CoursesAndExamsSkeleton />;
  }

  const { studentCourses: courses } = overview;
  const activeCourses = courses.filter((c) => c.status === "IN_PROGRESS");
  const activeCategories = activeCourses.map((c) => c.category);

  return (
    <div className="space-y-6">
      {/* Active courses — one card per in-progress course (e.g. A + B in parallel) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {activeCourses.length > 1 ? t("courses.currentCourses") : t("courses.currentCourse")}
          </h2>
          {canManage && (
            <Button size="sm" onClick={() => setShowStart(true)}>
              {t("courses.startCourse")}
            </Button>
          )}
        </div>

        {activeCourses.length === 0 ? (
          <div className="rounded-xl border bg-card p-4 sm:p-5 card-shadow">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">{t("courses.noActiveCourse")}</p>
            </div>
          </div>
        ) : (
          activeCourses.map((course) => {
            const decided = course.practicalAttended + course.practicalMissed;
            const attendanceRate = decided > 0 ? Math.round((course.practicalAttended / decided) * 100) : null;
            const practicalTotal = course.practicalAttended + course.practicalMissed + course.practicalScheduled;
            const examPassed = course.exams.filter((e) => e.result === "PASSED").length;
            const examFailed = course.exams.filter((e) => e.result === "FAILED").length;
            const examScheduled = course.exams.filter((e) => e.result === "SCHEDULED").length;

            return (
              <div key={course.id} className="@container rounded-xl border bg-card p-4 sm:p-5 card-shadow">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                        <span className="text-lg font-bold">{t(`categories.${course.category}`)}</span>
                        <span className="text-sm text-muted-foreground truncate">
                          · {t(`categories.${course.category}_desc`)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      {/* Container query: when the card itself is narrower
                          than @2xl (672px) — e.g. mobile, or a sidebar-eaten
                          laptop layout — collapse to icons only. Above that,
                          full PT labels reappear. title= keeps the action
                          name discoverable on hover/long-press. */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        title={t("exams.schedule")}
                        onClick={() => setScheduleForCourse(course)}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        <span className="hidden @2xl:inline">{t("exams.schedule")}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        title={t("common.exportPDF")}
                        disabled={!header}
                        onClick={() => {
                          if (!header) return;
                          exportCourseProgressPDF({
                            student: {
                              name: header.name,
                              email: header.email,
                              phone: header.phone,
                              school: header.school,
                              createdAt: header.createdAt,
                            },
                            course,
                            enrollments: course.practicalEnrollments,
                          });
                        }}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        <span className="hidden @2xl:inline">{t("common.exportPDF")}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        title={t("courses.completeCourse")}
                        onClick={() => setCompleteId(course.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="hidden @2xl:inline">{t("courses.completeCourse")}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        title={t("courses.abandonCourse")}
                        onClick={() => setAbandonId(course.id)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="hidden @2xl:inline">{t("courses.abandonCourse")}</span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Per-category stats: practical attendance + exam result counts */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">{t("courses.practicalProgress")}</p>
                    {practicalTotal === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">{t("courses.noPracticalYet")}</p>
                    ) : (
                      <>
                        <p className="mt-1 text-lg font-semibold">
                          {course.practicalAttended}/{course.practicalAttended + course.practicalMissed}
                        </p>
                        {attendanceRate !== null && (
                          <p className="text-xs text-muted-foreground">
                            {t("courses.attendanceRate", { rate: attendanceRate })}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">{t("courses.examProgress")}</p>
                    {course.exams.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">{t("courses.noExamsYet")}</p>
                    ) : (
                      <p className="mt-1 text-sm">
                        {t("courses.examsBreakdown", {
                          passed: examPassed,
                          failed: examFailed,
                          scheduled: examScheduled,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Course history */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("courses.courseHistory")}</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("courses.noCourses")}</p>
        ) : (
          <div className="space-y-2">
            {courses.map((course) => (
              <div key={course.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={course.category} />
                    <span className="font-medium">{t(`categories.${course.category}`)}</span>
                    <Badge variant={COURSE_STATUS_VARIANT[course.status]}>
                      {t(COURSE_STATUS_KEYS[course.status])}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("courses.startedOn", { date: format.dateTime(new Date(course.startedAt), { day: "2-digit", month: "2-digit", year: "numeric" }) })}
                    {course.completedAt && (
                      <>
                        {" · "}
                        {course.status === "COMPLETED"
                          ? t("courses.completedOn", { date: format.dateTime(new Date(course.completedAt), { day: "2-digit", month: "2-digit", year: "numeric" }) })
                          : t("courses.abandonedOn", { date: format.dateTime(new Date(course.completedAt), { day: "2-digit", month: "2-digit", year: "numeric" }) })}
                      </>
                    )}
                  </div>
                </div>
                {course.exams.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {course.exams.map((exam) => (
                      <div
                        key={exam.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {exam.type === "THEORY" ? t("exams.theory") : t("exams.practical")}
                          </Badge>
                          <span>
                            {format.dateTime(new Date(exam.scheduledAt), {
                              day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                          {exam.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {exam.location}
                            </span>
                          )}
                          {exam.instructor && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <UserIcon className="h-3 w-3" />
                              {exam.instructor.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={RESULT_VARIANT[exam.result]}>
                            {t(RESULT_KEYS[exam.result])}
                          </Badge>
                          {canManage && exam.result === "SCHEDULED" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => setRecordResultExamId(exam.id)}
                              >
                                <FileText className="h-3 w-3" />
                                {t("exams.recordResult")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCancelExamId(exam.id)}
                              >
                                {t("common.cancel")}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <StartCourseDialog
        studentId={studentId}
        excludeCategories={activeCategories}
        open={showStart}
        onClose={() => setShowStart(false)}
      />

      {scheduleForCourse && (
        <ScheduleExamDialog
          studentId={studentId}
          courseId={scheduleForCourse.id}
          category={scheduleForCourse.category}
          timeZone={header?.school.timeZone ?? "Europe/Lisbon"}
          open={scheduleForCourse !== null}
          onClose={() => setScheduleForCourse(null)}
        />
      )}

      {recordResultExamId && (
        <RecordExamResultDialog
          examId={recordResultExamId}
          studentId={studentId}
          open={recordResultExamId !== null}
          onClose={() => setRecordResultExamId(null)}
        />
      )}

      <ConfirmDialog
        open={completeId !== null}
        title={t("courses.completeCourse")}
        message={t("courses.completeCourseConfirm")}
        confirmLabel={t("common.confirm")}
        loading={completeMutation.isPending}
        onConfirm={() => completeId && completeMutation.mutate({ id: completeId })}
        onClose={() => setCompleteId(null)}
        variant="default"
      />

      <ConfirmDialog
        open={abandonId !== null}
        title={t("courses.abandonCourse")}
        message={t("courses.abandonCourseConfirm")}
        confirmLabel={t("common.confirm")}
        loading={abandonMutation.isPending}
        onConfirm={() => abandonId && abandonMutation.mutate({ id: abandonId })}
        onClose={() => setAbandonId(null)}
        variant="destructive"
      />

      <ConfirmDialog
        open={cancelExamId !== null}
        title={t("exams.cancelExam")}
        message={t("exams.cancelExamConfirm")}
        confirmLabel={t("common.confirm")}
        loading={cancelExamMutation.isPending}
        onConfirm={() => cancelExamId && cancelExamMutation.mutate({ id: cancelExamId })}
        onClose={() => setCancelExamId(null)}
        variant="destructive"
      />
    </div>
  );
}

function CoursesAndExamsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="rounded-xl border bg-card p-4 sm:p-5 card-shadow space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}
