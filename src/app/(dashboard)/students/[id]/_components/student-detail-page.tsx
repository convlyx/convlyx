"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
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
} from "lucide-react";
import { EditUserDialog } from "@/app/(dashboard)/users/_components/edit-user-dialog";
import { Loading } from "@/components/loading";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { typeKeys, enrollmentStatusKeys, enrollmentStatusVariant, classTypeBadgeClass, resolveEnrollmentDisplay } from "@/lib/constants/class";
import { exportStudentProgressPDF } from "@/lib/pdf-export";

const HISTORY_PER_PAGE = 10;

export function StudentDetailPage({
  id,
}: {
  id: string;
}) {
  const t = useTranslations();
  const format = useFormatter();

  const [historyPage, setHistoryPage] = useState(1);
  const [showEdit, setShowEdit] = useState(false);
  const utils = trpc.useUtils();
  const { data: student, isLoading } = trpc.user.studentProfile.useQuery({ id });

  if (isLoading) {
    return <Loading />;
  }

  if (!student) {
    return <p className="text-sm text-destructive p-6">{t("users.notFound")}</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/students" className="inline-flex">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </Link>

      {/* Profile header */}
      <div className="flex items-start gap-6 rounded-xl border bg-card p-6 card-shadow">
        {/* Photo placeholder */}
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <GraduationCap className="h-8 w-8" />
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-muted border-2 border-card">
            <Camera className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{student.name}</h1>
              <Badge variant={student.status === "ACTIVE" ? "default" : "destructive"}>
                {student.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
              </Badge>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowEdit(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("common.edit")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => exportStudentProgressPDF(student)}
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("common.exportPDF")}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {student.email}
            </span>
            {student.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {student.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {student.school.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
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
                .map((enrollment) => (
                <Link
                  key={enrollment.id}
                  href={`/classes/${enrollment.session.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={classTypeBadgeClass[enrollment.session.classType]}>
                      {t(typeKeys[enrollment.session.classType])}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{enrollment.session.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.session.instructor.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm">
                        {format.dateTime(new Date(enrollment.session.startsAt), {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {(() => {
                      const displayStatus = resolveEnrollmentDisplay(enrollment.status, enrollment.session.status);
                      return (
                        <Badge variant={enrollmentStatusVariant[displayStatus] ?? "outline"}>
                          {t(enrollmentStatusKeys[displayStatus] ?? displayStatus)}
                        </Badge>
                      );
                    })()}
                  </div>
                </Link>
              ))}
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
    </div>
  );
}
