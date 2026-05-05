"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/category-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GraduationCap, CalendarPlus, CheckCircle2, XCircle, FileText, MapPin, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { StartCourseDialog } from "./start-course-dialog";
import { ScheduleExamDialog } from "./schedule-exam-dialog";
import { RecordExamResultDialog } from "./record-exam-result-dialog";
import type { LicenseCategory } from "@/lib/license-categories";
import type { UserRole } from "@/generated/prisma/enums";

type Course = {
  id: string;
  category: LicenseCategory;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  startedAt: Date | string;
  completedAt: Date | string | null;
  exams: Array<{
    id: string;
    type: "THEORY" | "PRACTICAL";
    scheduledAt: Date | string;
    result: "SCHEDULED" | "PASSED" | "FAILED" | "NO_SHOW" | "CANCELLED";
    location: string | null;
    instructor: { id: string; name: string } | null;
  }>;
};

type Props = {
  studentId: string;
  courses: Course[];
  userRole: UserRole;
};

const RESULT_VARIANT: Record<Course["exams"][number]["result"], "default" | "secondary" | "destructive" | "outline"> = {
  SCHEDULED: "secondary",
  PASSED: "default",
  FAILED: "destructive",
  NO_SHOW: "destructive",
  CANCELLED: "outline",
};

const RESULT_KEYS: Record<Course["exams"][number]["result"], string> = {
  SCHEDULED: "exams.scheduledStatus",
  PASSED: "exams.passedStatus",
  FAILED: "exams.failedStatus",
  NO_SHOW: "exams.noShowStatus",
  CANCELLED: "exams.cancelledStatus",
};

const COURSE_STATUS_KEYS: Record<Course["status"], string> = {
  IN_PROGRESS: "courses.statusInProgress",
  COMPLETED: "courses.statusCompleted",
  ABANDONED: "courses.statusAbandoned",
};

const COURSE_STATUS_VARIANT: Record<Course["status"], "default" | "secondary" | "destructive" | "outline"> = {
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  ABANDONED: "outline",
};

export function CoursesAndExamsSection({ studentId, courses, userRole }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();

  const [showStart, setShowStart] = useState(false);
  const [scheduleForCourse, setScheduleForCourse] = useState<Course | null>(null);
  const [recordResultExamId, setRecordResultExamId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [abandonId, setAbandonId] = useState<string | null>(null);
  const [cancelExamId, setCancelExamId] = useState<string | null>(null);

  const canManage = userRole === "ADMIN" || userRole === "SECRETARY";
  const activeCourse = courses.find((c) => c.status === "IN_PROGRESS") ?? null;

  const completeMutation = trpc.course.complete.useMutation({
    onSuccess: () => {
      toast.success(t("toast.courseCompleted"));
      utils.user.studentProfile.invalidate({ id: studentId });
      setCompleteId(null);
    },
    onError,
  });

  const abandonMutation = trpc.course.abandon.useMutation({
    onSuccess: () => {
      toast.success(t("toast.courseAbandoned"));
      utils.user.studentProfile.invalidate({ id: studentId });
      setAbandonId(null);
    },
    onError,
  });

  const cancelExamMutation = trpc.exam.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.examCancelled"));
      utils.user.studentProfile.invalidate({ id: studentId });
      utils.exam.list.invalidate();
      setCancelExamId(null);
    },
    onError,
  });

  return (
    <div className="space-y-6">
      {/* Active course header */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 card-shadow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t("courses.currentCourse")}
              </h2>
              {activeCourse ? (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 mt-0.5">
                  <span className="text-lg font-bold">{t(`categories.${activeCourse.category}`)}</span>
                  <span className="text-sm text-muted-foreground truncate">
                    · {t(`categories.${activeCourse.category}_desc`)}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">{t("courses.noActiveCourse")}</p>
              )}
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              {activeCourse ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setScheduleForCourse(activeCourse)}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    {t("exams.schedule")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setCompleteId(activeCourse.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("courses.completeCourse")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setAbandonId(activeCourse.id)}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t("courses.abandonCourse")}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setShowStart(true)}>
                  {t("courses.startCourse")}
                </Button>
              )}
            </div>
          )}
        </div>
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
        open={showStart}
        onClose={() => setShowStart(false)}
      />

      {scheduleForCourse && (
        <ScheduleExamDialog
          studentId={studentId}
          courseId={scheduleForCourse.id}
          category={scheduleForCourse.category}
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
