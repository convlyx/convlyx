"use client";

import { useState, useEffect } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ClipboardList, BookOpen, CalendarDays, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { Loading } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { typeKeys, enrollmentStatusKeys, enrollmentStatusVariant, classTypeColorMap, classTypeBadgeClass, resolveEnrollmentDisplay } from "@/lib/constants/class";
import { Pagination } from "@/components/pagination";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import type { UserRole } from "@/generated/prisma/enums";
import { ITEMS_PER_PAGE } from "@/lib/constants/pagination";

export function EnrollmentsList({ userRole }: { userRole: UserRole }) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const format = useFormatter();
  const [view, setView] = useViewMode("/enrollments");
  const utils = trpc.useUtils();

  const [timeTab, setTimeTab] = useState<"current" | "past">("current");
  const [page, setPage] = useState(1);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const { data: enrollmentsData, isLoading } = trpc.enrollment.listByStudent.useQuery({
    time: timeTab,
    page,
    pageSize: ITEMS_PER_PAGE,
  });
  const paginatedEnrollments = enrollmentsData?.items ?? [];
  const total = enrollmentsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const cancelMutation = trpc.enrollment.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.enrollmentCancelled"));
      utils.enrollment.listByStudent.invalidate();
      utils.class.list.invalidate();
    },
    onError,
  });

  const canCancel = (enrollment: { status: string; session: { status: string } }) =>
    userRole === "STUDENT" && enrollment.status === "ENROLLED" && enrollment.session.status === "SCHEDULED";

  // Capture once on mount — the cancellation notice window is approximate
  // and doesn't need to update millisecond-by-millisecond as the user views.
  const [nowMs] = useState(() => Date.now());

  const isWithinNoticeWindow = (enrollment: {
    session: { startsAt: Date; school: { cancellationNoticeHours: number } };
  }) => {
    const noticeHours = enrollment.session.school.cancellationNoticeHours;
    if (noticeHours <= 0) return false;
    return enrollment.session.startsAt.getTime() - nowMs < noticeHours * 3600_000;
  };

  useEffect(() => setPage(1), [timeTab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("enrollments.myEnrollments")}</h1>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Time tabs */}
      <div className="flex items-center gap-1 rounded-lg border p-0.5 w-fit">
        <Button
          variant={timeTab === "current" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTimeTab("current")}
        >
          {t("classes.upcoming")}
        </Button>
        <Button
          variant={timeTab === "past" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTimeTab("past")}
        >
          {t("classes.past")}
        </Button>
      </div>

      {isLoading ? (
        <Loading />
      ) : total === 0 ? (
        <EmptyState icon={ClipboardList} message={t("common.noResults")} />
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {paginatedEnrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${classTypeColorMap[enrollment.session.classType]}`}>
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium truncate">{enrollment.session.title}</p>
                    <Badge className={classTypeBadgeClass[enrollment.session.classType]}>{t(typeKeys[enrollment.session.classType])}</Badge>
                    {(() => {
                      const ds = resolveEnrollmentDisplay(enrollment.status, enrollment.session.status);
                      return (
                        <Badge variant={enrollmentStatusVariant[ds] ?? "outline"}>
                          {t(enrollmentStatusKeys[ds] ?? ds)}
                        </Badge>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1 truncate"><Users className="h-3.5 w-3.5 shrink-0" />{enrollment.session.instructor.name}</span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {format.dateTime(new Date(enrollment.session.startsAt), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {format.dateTime(new Date(enrollment.session.endsAt), { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {canCancel(enrollment) && (
                    <div className="mt-2 sm:hidden">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        disabled={cancelMutation.isPending || isWithinNoticeWindow(enrollment)}
                        onClick={() => setConfirmCancelId(enrollment.id)}
                      >
                        {t("enrollments.cancel")}
                      </Button>
                      {isWithinNoticeWindow(enrollment) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("enrollments.cancellationLockedHint", { hours: enrollment.session.school.cancellationNoticeHours })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {canCancel(enrollment) && (
                  <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-1 shrink-0">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={cancelMutation.isPending || isWithinNoticeWindow(enrollment)}
                      onClick={() => setConfirmCancelId(enrollment.id)}
                    >
                      {t("enrollments.cancel")}
                    </Button>
                    {isWithinNoticeWindow(enrollment) && (
                      <p className="text-xs text-muted-foreground text-right">
                        {t("enrollments.cancellationLockedHint", { hours: enrollment.session.school.cancellationNoticeHours })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border card-shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("classes.type")}</TableHead>
                <TableHead>{t("classes.instructor")}</TableHead>
                <TableHead>{t("classes.date")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                {userRole === "STUDENT" && <TableHead>{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEnrollments.map((enrollment) => (
                <TableRow key={enrollment.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{enrollment.session.title}</TableCell>
                  <TableCell><Badge className={classTypeBadgeClass[enrollment.session.classType]}>{t(typeKeys[enrollment.session.classType])}</Badge></TableCell>
                  <TableCell>{enrollment.session.instructor.name}</TableCell>
                  <TableCell>
                    {format.dateTime(new Date(enrollment.session.startsAt), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {format.dateTime(new Date(enrollment.session.endsAt), { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const ds = resolveEnrollmentDisplay(enrollment.status, enrollment.session.status);
                      return (
                        <Badge variant={enrollmentStatusVariant[ds] ?? "outline"}>
                          {t(enrollmentStatusKeys[ds] ?? ds)}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  {userRole === "STUDENT" && (
                    <TableCell>
                      {canCancel(enrollment) && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={cancelMutation.isPending || isWithinNoticeWindow(enrollment)}
                            onClick={() => setConfirmCancelId(enrollment.id)}
                          >
                            {t("enrollments.cancel")}
                          </Button>
                          {isWithinNoticeWindow(enrollment) && (
                            <p className="text-xs text-muted-foreground">
                              {t("enrollments.cancellationLockedHint", { hours: enrollment.session.school.cancellationNoticeHours })}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={confirmCancelId !== null}
        onClose={() => setConfirmCancelId(null)}
        onConfirm={() => {
          cancelMutation.mutate({ enrollmentId: confirmCancelId! });
          setConfirmCancelId(null);
        }}
        title={t("classes.cancelOwnEnrollmentTitle")}
        message={t("classes.cancelOwnEnrollmentMessage")}
        loading={cancelMutation.isPending}
      />
    </div>
  );
}
