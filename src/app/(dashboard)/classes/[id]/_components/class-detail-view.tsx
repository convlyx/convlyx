"use client";

import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DetailPageSkeleton } from "@/components/skeletons/detail-page-skeleton";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { StudentPicker } from "@/components/student-picker";
import {
  typeKeys, statusKeys, statusVariant, enrollmentStatusKeys, enrollmentStatusVariant, classTypeColorMap, classTypeBadgeClass, resolveEnrollmentDisplay,
} from "@/lib/constants/class";
import { Textarea } from "@/components/ui/textarea";
import { CategoryBadge } from "@/components/category-badge";
import {
  ArrowLeft, BookOpen, CalendarDays, Clock, Users, UserPlus,
  CheckCircle, XCircle, Building2, Pencil, CheckCheck, FileDown, QrCode,
} from "lucide-react";
import { exportClassAttendancePDF } from "@/lib/pdf-export";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { track } from "@/lib/posthog";
import { useState } from "react";
import type { UserRole } from "@/generated/prisma/enums";
import { EditClassDialog } from "@/app/(dashboard)/classes/_components/edit-class-dialog";

export function ClassDetailView({
  classId,
  userRole,
}: {
  classId: string;
  userRole: UserRole;
}) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const format = useFormatter();
  const utils = trpc.useUtils();
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [cancelClassConfirm, setCancelClassConfirm] = useState(false);
  const [removeEnrollmentId, setRemoveEnrollmentId] = useState<string | null>(null);
  const [confirmCompletedEnroll, setConfirmCompletedEnroll] = useState(false);
  const [pendingAttendanceChange, setPendingAttendanceChange] = useState<{ enrollmentId: string; status: "ATTENDED" | "NO_SHOW" } | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showEditClass, setShowEditClass] = useState(false);
  const [noteText, setNoteText] = useState("");

  const { data: classDetail, isLoading, isError } = trpc.class.getById.useQuery(
    { id: classId },
    { retry: false }
  );
  const staffRole = userRole === "ADMIN" || userRole === "SECRETARY" || userRole === "INSTRUCTOR";
  // Fetches ALL active students unbounded, then filters by category + search
  // client-side in StudentPicker. Gated to `showAddStudent` so it only loads
  // when staff actually open the picker — not on every detail view.
  // SCALING CLIFF: payload grows with the tenant and user.list's auth merge
  // caps at ~1000 (see user.ts) — switch to server-side paginated search when
  // a tenant approaches that range.
  const { data: allStudentsData } = trpc.user.list.useQuery(
    { role: "STUDENT", status: "ACTIVE" },
    { enabled: staffRole && showAddStudent },
  );
  const allStudents = allStudentsData?.items;

  const enrollMutation = trpc.enrollment.enroll.useMutation({
    onSuccess: () => {
      toast.success(t("toast.studentEnrolled"));
      utils.class.getById.invalidate({ id: classId });
      utils.class.list.invalidate();
      track("student_enrolled", { source: "class_detail", class_id: classId });
      setSelectedStudents([]);
      setShowAddStudent(false);
    },
    onError,
  });

  const cancelEnrollmentMutation = trpc.enrollment.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.enrollmentRemoved"));
      utils.class.getById.invalidate({ id: classId });
      utils.class.list.invalidate();
      track("student_removed", { source: "class_detail", class_id: classId });
    },
    onError,
  });

  const markAttendanceMutation = trpc.enrollment.markAttendance.useMutation({
    onSuccess: (_data, vars) => {
      toast.success(t("toast.attendanceRecorded"));
      utils.class.getById.invalidate({ id: classId });
      track("attendance_marked", { status: vars.status, class_id: classId });
    },
    onError,
  });

  const cancelClassMutation = trpc.class.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.classCancelled"));
      utils.class.getById.invalidate({ id: classId });
      utils.class.list.invalidate();
      track("class_cancelled", { class_id: classId });
      setCancelClassConfirm(false);
    },
    onError,
  });

  const bulkAttendanceMutation = trpc.enrollment.bulkMarkAttendance.useMutation({
    onSuccess: (_data, vars) => {
      toast.success(t("enrollments.allMarkedPresent"));
      utils.class.getById.invalidate({ id: classId });
      track("attendance_bulk_marked", { status: vars.status, class_id: classId });
    },
    onError,
  });

  const addNoteMutation = trpc.enrollment.addNote.useMutation({
    onSuccess: () => {
      toast.success(t("enrollments.noteSaved"));
      utils.class.getById.invalidate({ id: classId });
      setEditingNoteId(null);
      setNoteText("");
    },
    onError,
  });

  if (isLoading) return <DetailPageSkeleton stats={0} sections={2} />;
  if (isError || !classDetail) {
    return (
      <div className="space-y-4">
        <Link href="/classes" className="inline-flex">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
        </Link>
        <EmptyState icon={BookOpen} message={t("classes.notFound")} />
      </div>
    );
  }

  const enrolledStudents = classDetail.enrollments.filter((e) => e.status === "ENROLLED");
  const attendedStudents = classDetail.enrollments.filter((e) => e.status === "ATTENDED");
  const noShowStudents = classDetail.enrollments.filter((e) => e.status === "NO_SHOW");
  const spotsLeft = classDetail.capacity - classDetail.enrollments.length;
  const enrolledStudentIds = new Set(classDetail.enrollments.map((e) => e.student.id));
  // For practical classes, only students whose active StudentCourse matches
  // the class's category are eligible to be added. Theory classes have no
  // category, so any unenrolled student is eligible.
  const availableStudents = allStudents?.filter((s) => {
    if (enrolledStudentIds.has(s.id)) return false;
    if (classDetail.classType === "PRACTICAL" && classDetail.category) {
      return s.currentCategory === classDetail.category;
    }
    return true;
  }) ?? [];

  const isActive = classDetail.status === "SCHEDULED" || classDetail.status === "IN_PROGRESS";
  const canMarkAttendance = classDetail.status === "IN_PROGRESS" || classDetail.status === "COMPLETED";
  const isStaff = userRole === "ADMIN" || userRole === "SECRETARY";
  const isInstructor = userRole === "INSTRUCTOR";
  const canAddStudent = (isStaff || isInstructor) && classDetail.status !== "CANCELLED";

  // QR check-in: theory class currently within its time window, for staff/instructor.
  const nowMs = new Date().getTime();
  const canOpenCheckIn =
    classDetail.classType === "THEORY" &&
    (isStaff || isInstructor) &&
    classDetail.status !== "CANCELLED" &&
    new Date(classDetail.startsAt).getTime() <= nowMs &&
    new Date(classDetail.endsAt).getTime() >= nowMs;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back */}
      <Link href="/classes" className="inline-flex">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </Link>

      {/* Header card */}
      <div className="rounded-xl border bg-card p-6 card-shadow">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${classTypeColorMap[classDetail.classType]}`}>
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{classDetail.title}</h1>
                <Badge className={classTypeBadgeClass[classDetail.classType]}>{t(typeKeys[classDetail.classType])}</Badge>
                <CategoryBadge category={classDetail.category} />
                <Badge variant={statusVariant[classDetail.status] ?? "outline"}>
                  {t(statusKeys[classDetail.status])}
                </Badge>
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0" />
                  <Link href={`/instructors/${classDetail.instructor.id}`} className="hover:underline hover:text-foreground transition-colors">
                    {classDetail.instructor.name}
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0" />
                  {classDetail.school.name}
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  {format.dateTime(new Date(classDetail.startsAt), {
                    weekday: "long", day: "2-digit", month: "long", year: "numeric",
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  {format.dateTime(new Date(classDetail.startsAt), { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {format.dateTime(new Date(classDetail.endsAt), { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {canOpenCheckIn && (
              <Link
                href={`/checkin-display/${classDetail.id}`}
                className={buttonVariants({ size: "sm", className: "gap-1.5" })}
              >
                <QrCode className="h-3.5 w-3.5" />
                {t("checkin.bannerAction")}
              </Link>
            )}
            {isStaff && isActive && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowEditClass(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("common.edit")}
              </Button>
            )}
            {classDetail.status === "COMPLETED" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => exportClassAttendancePDF(classDetail)}
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("common.exportPDF")}
              </Button>
            )}
            {isStaff && isActive && (
              <Button
                variant="destructive"
                size="sm"
                disabled={cancelClassMutation.isPending}
                onClick={() => setCancelClassConfirm(true)}
              >
                {t("classes.cancelClass")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label={t("dashboard.enrolled")} value={classDetail.enrollments.length} description={t("classes.spotsOf", { capacity: classDetail.capacity })} />
        <StatCard icon={CheckCircle} label={t("dashboard.attendances")} value={attendedStudents.length} />
        <StatCard icon={XCircle} label={t("dashboard.absences")} value={noShowStudents.length} />
        <StatCard icon={CalendarDays} label={t("dashboard.vacancies")} value={spotsLeft > 0 ? spotsLeft : 0} />
      </div>

      {/* Add student */}
      {canAddStudent && (
        <div className="rounded-xl border bg-card p-4 card-shadow">
          {showAddStudent ? (
            <div className="space-y-3">
              {/* Header keeps the submit + cancel buttons OUT of the
                  picker dropdown's flight path (dropdown is absolute
                  and extends downward). User can see the "Inscrever N"
                  count grow as they select, click when ready. */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t("classes.addStudent")}</h3>
                <div className="flex items-center gap-2">
                  {selectedStudents.length > 0 && (
                    <Button
                      size="sm"
                      disabled={enrollMutation.isPending}
                      onClick={() => {
                        if (classDetail.status === "COMPLETED") {
                          setConfirmCompletedEnroll(true);
                        } else {
                          selectedStudents.forEach((studentId) => {
                            enrollMutation.mutate({ sessionId: classDetail.id, studentId });
                          });
                        }
                      }}
                    >
                      {enrollMutation.isPending ? t("common.loading") : t("classes.enrollCount", { count: selectedStudents.length })}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setShowAddStudent(false); setSelectedStudents([]); }}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
              <StudentPicker
                students={availableStudents}
                selected={selectedStudents}
                onChange={setSelectedStudents}
                max={spotsLeft}
              />
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAddStudent(true)}>
              <UserPlus className="h-4 w-4" />
              {t("classes.addStudent")}
            </Button>
          )}
        </div>
      )}

      {/* Enrolled students */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("nav.students")} ({classDetail.enrollments.length})</h2>
          {canMarkAttendance && enrolledStudents.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={bulkAttendanceMutation.isPending}
              onClick={() => bulkAttendanceMutation.mutate({ sessionId: classDetail.id, status: "ATTENDED" })}
            >
              <CheckCheck className="h-4 w-4" />
              {t("enrollments.markAllPresent")}
            </Button>
          )}
        </div>

        {classDetail.enrollments.length === 0 ? (
          <EmptyState icon={Users} message={t("classes.noStudents")} />
        ) : (
          <div className="space-y-2">
            {classDetail.enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all"
              >
                <UserAvatar
                  name={enrollment.student.name}
                  className="h-10 w-10 bg-primary/10 text-primary shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/students/${enrollment.student.id}`} className="text-sm font-semibold truncate hover:underline hover:text-primary transition-colors">
                      {enrollment.student.name}
                    </Link>
                    {(() => {
                      const displayStatus = resolveEnrollmentDisplay(enrollment.status, classDetail.status);
                      return (
                        <Badge variant={enrollmentStatusVariant[displayStatus] ?? "outline"}>
                          {t(enrollmentStatusKeys[displayStatus] ?? displayStatus)}
                        </Badge>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{enrollment.student.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("classes.enrolledAt", {
                      date: format.dateTime(new Date(enrollment.enrolledAt), {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      }),
                    })}
                  </p>
                  {/* Notes display and editing */}
                  {editingNoteId === enrollment.id ? (
                    <div className="mt-2 space-y-1.5">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder={t("enrollments.notePlaceholder")}
                        className="text-xs min-h-[60px]"
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={addNoteMutation.isPending}
                          onClick={() => addNoteMutation.mutate({ enrollmentId: enrollment.id, notes: noteText })}
                        >
                          {t("common.save")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingNoteId(null); setNoteText(""); }}>
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-start gap-1">
                      {enrollment.notes ? (
                        <p className="text-xs text-muted-foreground italic">{enrollment.notes}</p>
                      ) : null}
                      {userRole === "INSTRUCTOR" && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0"
                          onClick={() => { setEditingNoteId(enrollment.id); setNoteText(enrollment.notes ?? ""); }}
                          title={enrollment.notes ? t("enrollments.editNote") : t("enrollments.addNote")}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                  {enrollment.status === "ENROLLED" && canMarkAttendance && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markAttendanceMutation.isPending}
                        onClick={() => markAttendanceMutation.mutate({
                          enrollmentId: enrollment.id,
                          status: "ATTENDED",
                        })}
                      >
                        <CheckCircle className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">{t("enrollments.attended")}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markAttendanceMutation.isPending}
                        onClick={() => markAttendanceMutation.mutate({
                          enrollmentId: enrollment.id,
                          status: "NO_SHOW",
                        })}
                      >
                        <XCircle className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">{t("enrollments.noShow")}</span>
                      </Button>
                    </>
                  )}
                  {(isStaff || isInstructor) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={cancelEnrollmentMutation.isPending}
                      onClick={() => setRemoveEnrollmentId(enrollment.id)}
                    >
                      <span className="hidden sm:inline">{t("enrollments.remove")}</span>
                      <span className="sm:hidden">×</span>
                    </Button>
                  )}
                </div>
                {classDetail.status === "COMPLETED" && (enrollment.status === "ATTENDED" || enrollment.status === "NO_SHOW") && (
                  <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                    {enrollment.status === "NO_SHOW" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markAttendanceMutation.isPending}
                        onClick={() => setPendingAttendanceChange({ enrollmentId: enrollment.id, status: "ATTENDED" })}
                      >
                        <CheckCircle className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">{t("enrollments.attended")}</span>
                      </Button>
                    )}
                    {enrollment.status === "ATTENDED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markAttendanceMutation.isPending}
                        onClick={() => setPendingAttendanceChange({ enrollmentId: enrollment.id, status: "NO_SHOW" })}
                      >
                        <XCircle className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">{t("enrollments.noShow")}</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Class meta info */}
      {classDetail.createdBy && (
        <div className="text-xs text-muted-foreground">
          {t("classes.createdBy", { name: classDetail.createdBy.name })}
        </div>
      )}

      <ConfirmDialog
        open={cancelClassConfirm}
        onClose={() => setCancelClassConfirm(false)}
        onConfirm={() => {
          cancelClassMutation.mutate({ id: classDetail.id });
        }}
        title={t("classes.cancelClassConfirmTitle")}
        message={t("classes.cancelClassConfirmMessage")}
        loading={cancelClassMutation.isPending}
      />

      <ConfirmDialog
        open={removeEnrollmentId !== null}
        onClose={() => setRemoveEnrollmentId(null)}
        onConfirm={() => {
          if (removeEnrollmentId) cancelEnrollmentMutation.mutate({ enrollmentId: removeEnrollmentId });
          setRemoveEnrollmentId(null);
        }}
        title={t("classes.removeStudentTitle")}
        message={classDetail.status === "COMPLETED"
          ? t("classes.removeStudentCompletedMessage")
          : t("classes.removeStudentMessage")}
        loading={cancelEnrollmentMutation.isPending}
      />

      <ConfirmDialog
        open={confirmCompletedEnroll}
        onClose={() => setConfirmCompletedEnroll(false)}
        onConfirm={() => {
          selectedStudents.forEach((studentId) => {
            enrollMutation.mutate({ sessionId: classDetail.id, studentId });
          });
          setConfirmCompletedEnroll(false);
        }}
        title={t("classes.addStudentCompletedTitle")}
        message={t("classes.addStudentCompletedMessage")}
        loading={enrollMutation.isPending}
      />

      <ConfirmDialog
        open={pendingAttendanceChange !== null}
        onClose={() => setPendingAttendanceChange(null)}
        onConfirm={() => {
          if (pendingAttendanceChange) {
            markAttendanceMutation.mutate(pendingAttendanceChange);
          }
          setPendingAttendanceChange(null);
        }}
        title={t("classes.changeAttendanceCompletedTitle")}
        message={t("classes.changeAttendanceCompletedMessage")}
        loading={markAttendanceMutation.isPending}
      />

      {showEditClass && (
        <EditClassDialog
          classData={classDetail}
          open={showEditClass}
          onClose={() => {
            setShowEditClass(false);
            utils.class.getById.invalidate({ id: classId });
          }}
        />
      )}
    </div>
  );
}
