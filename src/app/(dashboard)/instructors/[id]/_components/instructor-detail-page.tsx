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
  CalendarDays,
  Clock,
  Users,
  Mail,
  Phone,
  Building2,
  Camera,
  XCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { EditUserDialog } from "@/app/(dashboard)/users/_components/edit-user-dialog";
import type { UserRole } from "@/generated/prisma/enums";
import { Loading } from "@/components/loading";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { typeKeys, statusKeys, statusVariant, classTypeBadgeClass } from "@/lib/constants/class";
import { ITEMS_PER_PAGE as HISTORY_PER_PAGE } from "@/lib/constants/pagination";

export function InstructorDetailPage({
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
  const router = useRouter();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();
  const { data: instructor, isLoading } = trpc.user.instructorProfile.useQuery({ id });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userDeleted"));
      utils.user.list.invalidate();
      router.push("/instructors");
    },
    onError,
  });

  const canDelete = userRole === "ADMIN";

  if (isLoading) {
    return <Loading />;
  }

  if (!instructor) {
    return <p className="text-sm text-destructive p-6">{t("users.notFound")}</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/instructors" className="inline-flex">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </Link>

      {/* Profile header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 rounded-xl border bg-card p-4 sm:p-6 card-shadow">
        <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 self-start">
          <Users className="h-7 w-7 sm:h-8 sm:w-8" />
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-muted border-2 border-card">
            <Camera className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{instructor.name}</h1>
              <Badge variant={instructor.status === "ACTIVE" ? "default" : "destructive"}>
                {instructor.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0 self-start">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowEdit(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("common.edit")}
              </Button>
              {canDelete && instructor.deletable && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("users.delete")}
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 min-w-0">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{instructor.email}</span>
            </span>
            {instructor.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {instructor.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5 min-w-0">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{instructor.school.name}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {t("users.memberSince")} {format.dateTime(new Date(instructor.createdAt), { month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label={t("users.upcomingClasses")} value={instructor.stats.upcomingClasses} />
        <StatCard icon={BookCheck} label={t("users.completedClasses")} value={instructor.stats.completedClasses} />
        <StatCard icon={BookOpen} label={t("users.totalClasses")} value={instructor.stats.totalClasses} />
        <StatCard icon={Users} label={t("users.studentsTaught")} value={instructor.stats.totalStudentsTaught} />
      </div>

      {/* Class type breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 rounded-full bg-blue-400" />
            <h3 className="text-sm font-medium text-muted-foreground">{t("users.theoryProgress")}</h3>
          </div>
          <p className="text-3xl font-bold">{instructor.stats.theoryClasses}</p>
          <p className="text-xs text-muted-foreground">{t("classes.title").toLowerCase()}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <h3 className="text-sm font-medium text-muted-foreground">{t("users.practicalProgress")}</h3>
          </div>
          <p className="text-3xl font-bold">{instructor.stats.practicalClasses}</p>
          <p className="text-xs text-muted-foreground">{t("classes.title").toLowerCase()}</p>
        </div>
      </div>

      {/* Class history */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("users.classHistory")}</h2>
        {instructor.instructedSessions.length === 0 ? (
          <EmptyState icon={BookOpen} message={t("users.noHistory")} />
        ) : (
          <>
            <div className="space-y-2">
              {instructor.instructedSessions
                .slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE)
                .map((session) => (
                <Link
                  key={session.id}
                  href={`/classes/${session.id}`}
                  className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge className={classTypeBadgeClass[session.classType]}>
                      {t(typeKeys[session.classType])}
                    </Badge>
                    <Badge variant={statusVariant[session.status] ?? "outline"} className="ml-auto">
                      {t(statusKeys[session.status] ?? session.status)}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium truncate">{session.title}</p>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="truncate">
                      {session._count.enrollments}/{session.capacity} {t("nav.students").toLowerCase()}
                    </span>
                    <span className="shrink-0">
                      {format.dateTime(new Date(session.startsAt), {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <Pagination
              page={historyPage}
              totalPages={Math.ceil(instructor.instructedSessions.length / HISTORY_PER_PAGE)}
              total={instructor.instructedSessions.length}
              onPageChange={setHistoryPage}
            />
          </>
        )}
      </div>

      {showEdit && (
        <EditUserDialog
          userData={{ ...instructor, role: "INSTRUCTOR" }}
          open={showEdit}
          onClose={() => {
            setShowEdit(false);
            utils.user.instructorProfile.invalidate({ id });
          }}
        />
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate({ id })}
        title={t("users.deleteTitle")}
        message={t("users.deleteMessage")}
        confirmLabel={t("users.delete")}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
