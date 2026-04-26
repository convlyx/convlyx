"use client";

import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { StudentPicker } from "@/components/student-picker";
import {
  typeKeys, statusKeys, statusVariant, enrollmentStatusKeys, enrollmentStatusVariant, classTypeColorMap,
} from "@/lib/constants/class";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, BookOpen, CalendarDays, Clock, Users, UserPlus,
  CheckCircle, XCircle, Building2, Pencil, CheckCheck, FileDown,
} from "lucide-react";
import { exportClassAttendancePDF } from "@/lib/pdf-export";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { useState } from "react";
import type { UserRole } from "@/generated/prisma/enums";

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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const { data: classDetail, isLoading, isError } = trpc.class.getById.useQuery(
    { id: classId },
    { retry: false }
  );
  const { data: allStudents } = trpc.user.list.useQuery({ role: "STUDENT" });

  const enrollMutation = trpc.enrollment.enroll.useMutation({
    onSuccess: () => {
      toast.success(t("toast.studentEnrolled"));
      utils.class.getById.invalidate({ id: classId });
      setSelectedStudents([]);
      setShowAddStudent(false);
    },
    onError,
  });

  const cancelEnrollmentMutation = trpc.enrollment.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.enrollmentRemoved"));
      utils.class.getById.invalidate({ id: classId });
    },
    onError,
  });

  const markAttendanceMutation = trpc.enrollment.markAttendance.useMutation({
    onSuccess: () => {
      toast.success(t("toast.attendanceRecorded"));
      utils.class.getById.invalidate({ id: classId });
    },
    onError,
  });

  const cancelClassMutation = trpc.class.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.classCancelled"));
      utils.class.getById.invalidate({ id: classId });
      utils.class.list.invalidate();
    },
    onError,
  });

  const bulkAttendanceMutation = trpc.enrollment.bulkMarkAttendance.useMutation({
    onSuccess: () => {
      toast.success(t("enrollment.allMarkedPresent"));
      utils.class.getById.invalidate({ id: classId });
    },
    onError,
  });

  const addNoteMutation = trpc.enrollment.addNote.useMutation({
    onSuccess: () => {
      toast.success(t("enrollment.noteSaved"));
      utils.class.getById.invalidate({ id: classId });
      setEditingNoteId(null);
      setNoteText("");
    },
    onError,
  });

  if (isLoading) return <Loading />;
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
  const cancelledStudents = classDetail.enrollments.filter((e) => e.status === "CANCELLED");
  const spotsLeft = classDetail.capacity - enrolledStudents.length;
  const enrolledStudentIds = new Set(classDetail.enrollments.map((e) => e.student.id));
  const availableStudents = allStudents?.filter((s) => !enrolledStudentIds.has(s.id)) ?? [];

  const isActive = classDetail.status === "SCHEDULED" || classDetail.status === "IN_PROGRESS";

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/classes" className="inline-flex">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border bg-card p-6 card-shadow">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${classTypeColorMap[classDetail.classType]}`}>
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{classDetail.title}</h1>
                <Badge variant="secondary">{t(typeKeys[classDetail.classType])}</Badge>
                <Badge variant={statusVariant[classDetail.status] ?? "outline"}>
                  {t(statusKeys[classDetail.status])}
                </Badge>
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0" />
                  {classDetail.instructor.name}
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportClassAttendancePDF(classDetail)}
            >
              <FileDown className="h-3.5 w-3.5" />
              {t("common.exportPDF")}
            </Button>
            {isActive && (
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
        <StatCard icon={Users} label={t("dashboard.enrolled")} value={enrolledStudents.length} description={t("classes.spotsOf", { capacity: classDetail.capacity })} />
        <StatCard icon={CheckCircle} label={t("dashboard.attendances")} value={attendedStudents.length} />
        <StatCard icon={XCircle} label={t("dashboard.absences")} value={noShowStudents.length} />
        <StatCard icon={CalendarDays} label={t("dashboard.vacancies")} value={spotsLeft > 0 ? spotsLeft : 0} />
      </div>

      {/* Add student */}
      {isActive && spotsLeft > 0 && (
        <div className="rounded-xl border bg-card p-4 card-shadow">
          {showAddStudent ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t("classes.addStudent")}</h3>
                <Button variant="ghost" size="sm" onClick={() => { setShowAddStudent(false); setSelectedStudents([]); }}>
                  {t("common.cancel")}
                </Button>
              </div>
              <StudentPicker
                students={availableStudents}
                selected={selectedStudents}
                onChange={setSelectedStudents}
                max={spotsLeft}
              />
              {selectedStudents.length > 0 && (
                <Button
                  size="sm"
                  disabled={enrollMutation.isPending}
                  onClick={() => {
                    selectedStudents.forEach((studentId) => {
                      enrollMutation.mutate({ sessionId: classDetail.id, studentId });
                    });
                  }}
                >
                  {enrollMutation.isPending ? t("common.loading") : t("classes.enrollCount", { count: selectedStudents.length })}
                </Button>
              )}
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
          {isActive && enrolledStudents.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={bulkAttendanceMutation.isPending}
              onClick={() => bulkAttendanceMutation.mutate({ sessionId: classDetail.id, status: "ATTENDED" })}
            >
              <CheckCheck className="h-4 w-4" />
              {t("enrollment.markAllPresent")}
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
                    <p className="text-sm font-semibold truncate">{enrollment.student.name}</p>
                    <Badge variant={enrollmentStatusVariant[enrollment.status] ?? "outline"}>
                      {t(enrollmentStatusKeys[enrollment.status] ?? enrollment.status)}
                    </Badge>
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
                        placeholder={t("enrollment.notePlaceholder")}
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
                          title={enrollment.notes ? t("enrollment.editNote") : t("enrollment.addNote")}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {enrollment.status === "ENROLLED" && isActive && (
                  <div className="flex flex-col sm:flex-row gap-1 shrink-0">
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
                      <span className="hidden sm:inline">{t("enrollment.attended")}</span>
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
                      <span className="hidden sm:inline">{t("enrollment.noShow")}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={cancelEnrollmentMutation.isPending}
                      onClick={() => setRemoveEnrollmentId(enrollment.id)}
                    >
                      <span className="hidden sm:inline">{t("enrollment.remove")}</span>
                      <span className="sm:hidden">×</span>
                    </Button>
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
          setCancelClassConfirm(false);
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
        message={t("classes.removeStudentMessage")}
        loading={cancelEnrollmentMutation.isPending}
      />
    </div>
  );
}
