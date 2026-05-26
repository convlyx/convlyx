"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  BookCheck,
  XCircle,
  CalendarDays,
  Clock,
  GraduationCap,
  Mail,
  Phone,
  Building2,
  Camera,
  FileDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { EditUserDialog } from "@/app/(dashboard)/_components/edit-user-dialog";
import { DetailPageSkeleton } from "@/components/skeletons/detail-page-skeleton";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { typeKeys, enrollmentStatusKeys, enrollmentStatusVariant, classTypeBadgeClass, resolveEnrollmentDisplay } from "@/lib/constants/class";
import { exportStudentProgressPDF } from "@/lib/pdf-export";
import { CategoryBadge } from "@/components/category-badge";
import { CoursesAndExamsSection } from "./courses-and-exams-section";
import type { UserRole } from "@/generated/prisma/enums";
import { ITEMS_PER_PAGE as HISTORY_PER_PAGE } from "@/lib/constants/pagination";

export function StudentDetailPage({
  id,
  userRole,
}: {
  id: string;
  userRole: UserRole;
}) {
  const t = useTranslations();
  const format = useFormatter();

  const [historyPage, setHistoryPage] = useState(1);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAnonymize, setShowAnonymize] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const router = useRouter();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();
  const { data: student, isLoading } = trpc.user.studentProfile.useQuery({ id });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userDeleted"));
      utils.user.list.invalidate();
      router.push("/students");
    },
    onError,
  });

  const anonymizeMutation = trpc.user.anonymize.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userAnonymized"));
      utils.user.list.invalidate();
      utils.user.studentProfile.invalidate({ id });
      setShowAnonymize(false);
    },
    onError,
  });

  const deactivateMutation = trpc.user.deactivate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userDeactivated"));
      utils.user.list.invalidate();
      utils.user.studentProfile.invalidate({ id });
    },
    onError,
  });

  const activateMutation = trpc.user.activate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userActivated"));
      utils.user.list.invalidate();
      utils.user.studentProfile.invalidate({ id });
    },
    onError,
  });

  const canDelete = userRole === "ADMIN";
  const canManage = userRole === "ADMIN" || userRole === "SECRETARY";

  if (isLoading) {
    return <DetailPageSkeleton stats={3} sections={2} />;
  }

  if (!student) {
    return <p className="text-sm text-destructive p-6">{t("users.notFound")}</p>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link href="/students" className="inline-flex">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </Link>

      {/* Profile header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 rounded-xl border bg-card p-4 sm:p-6 card-shadow">
        {/* Photo placeholder */}
        <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary self-start">
          <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8" />
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-muted border-2 border-card">
            <Camera className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{student.name}</h1>
              <Badge variant={student.status === "ACTIVE" ? "default" : "destructive"}>
                {student.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              {canManage && !student.anonymized && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowEdit(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("common.edit")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => exportStudentProgressPDF(student)}
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("common.exportPDF")}
              </Button>
              {/* Activate / deactivate doesn't apply to anonymized users —
                  there's no real account to (re-)enable. */}
              {canManage && !student.anonymized && (student.status === "ACTIVE" ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={deactivateMutation.isPending}
                  onClick={() => setShowDeactivate(true)}
                >
                  {t("users.deactivate")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={activateMutation.isPending}
                  onClick={() => activateMutation.mutate({ id })}
                >
                  {t("users.activate")}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 min-w-0">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{student.email}</span>
            </span>
            {student.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {student.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5 min-w-0">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{student.school.name}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {t("users.memberSince")} {format.dateTime(new Date(student.createdAt), { month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={BookOpen} label={t("users.totalClasses")} value={student.stats.totalClasses} />
        <StatCard icon={CalendarDays} label={t("users.upcomingClasses")} value={student.stats.upcoming} />
        <StatCard icon={BookCheck} label={t("users.classesAttended")} value={student.stats.totalAttended} />
        <StatCard icon={XCircle} label={t("users.classesMissed")} value={student.stats.totalNoShow} />
      </div>

      {/* Progress breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 card-shadow">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{t("users.theoryProgress")}</h3>
          <p className="text-3xl font-bold">{student.stats.theoryAttended}</p>
          <p className="text-xs text-muted-foreground">{t("users.classesAttended").toLowerCase()}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 card-shadow">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{t("users.practicalProgress")}</h3>
          <p className="text-3xl font-bold">{student.stats.practicalAttended}</p>
          <p className="text-xs text-muted-foreground">{t("users.classesAttended").toLowerCase()}</p>
        </div>
      </div>

      {/* Courses + exams */}
      <CoursesAndExamsSection
        studentId={id}
        courses={student.studentCourses}
        enrollments={student.enrollments}
        userRole={userRole}
      />

      {/* Enrollment history */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("users.enrollmentHistory")}</h2>
        {student.enrollments.length === 0 ? (
          <EmptyState icon={BookOpen} message={t("users.noHistory")} />
        ) : (
          <>
            <div className="space-y-2">
              {student.enrollments
                .slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE)
                .map((enrollment) => {
                const displayStatus = resolveEnrollmentDisplay(enrollment.status, enrollment.session.status);
                return (
                <Link
                  key={enrollment.id}
                  href={`/classes/${enrollment.session.id}`}
                  className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge className={classTypeBadgeClass[enrollment.session.classType]}>
                      {t(typeKeys[enrollment.session.classType])}
                    </Badge>
                    <CategoryBadge category={enrollment.session.category} />
                    <Badge variant={enrollmentStatusVariant[displayStatus] ?? "outline"} className="ml-auto">
                      {t(enrollmentStatusKeys[displayStatus] ?? displayStatus)}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium truncate">{enrollment.session.title}</p>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="truncate">{enrollment.session.instructor.name}</span>
                    <span className="shrink-0">
                      {format.dateTime(new Date(enrollment.session.startsAt), {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Link>
              );
              })}
            </div>
            <Pagination
              page={historyPage}
              totalPages={Math.ceil(student.enrollments.length / HISTORY_PER_PAGE)}
              total={student.enrollments.length}
              onPageChange={setHistoryPage}
            />
          </>
        )}
      </div>

      {/* Danger zone — ADMIN-only. Deletable users (no history) get hard
          delete; users with history can be anonymized in place instead
          (GDPR Art. 17 — keeps FK history, strips PII). Already-anonymized
          users have no remaining destructive action. */}
      {canDelete && !student.anonymized && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">{t("users.dangerZoneDescription")}</p>
          {student.deletable ? (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 sm:shrink-0"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("users.delete")}
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 sm:shrink-0"
              onClick={() => setShowAnonymize(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("users.anonymize")}
            </Button>
          )}
        </div>
      )}

      {showEdit && (
        <EditUserDialog
          userData={{ ...student, role: "STUDENT" }}
          open={showEdit}
          onClose={() => {
            setShowEdit(false);
            utils.user.studentProfile.invalidate({ id });
          }}
        />
      )}

      <ConfirmDialog
        open={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        onConfirm={() => {
          deactivateMutation.mutate({ id });
          setShowDeactivate(false);
        }}
        title={t("users.deactivateTitle")}
        message={t("users.deactivateMessage")}
        loading={deactivateMutation.isPending}
      />

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate({ id })}
        title={t("users.deleteTitle")}
        message={t("users.deleteMessage")}
        confirmLabel={t("users.delete")}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={showAnonymize}
        onClose={() => setShowAnonymize(false)}
        onConfirm={() => anonymizeMutation.mutate({ id })}
        title={t("users.anonymizeTitle")}
        message={t("users.anonymizeMessage")}
        confirmLabel={t("users.anonymize")}
        loading={anonymizeMutation.isPending}
      />
    </div>
  );
}
