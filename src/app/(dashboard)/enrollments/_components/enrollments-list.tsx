"use client";

import { useState, useEffect } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ClipboardList, BookOpen, CalendarDays, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { CardListSkeleton } from "@/components/skeletons/card-list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { typeKeys, enrollmentStatusKeys, enrollmentStatusVariant, classTypeColorMap, classTypeBadgeClass, resolveEnrollmentDisplay } from "@/lib/constants/class";
import { Pagination } from "@/components/pagination";
import { SegmentedTabs } from "@/components/segmented-tabs";
import { IconTile } from "@/components/icon-tile";
import { DataTableCard } from "@/components/data-table-card";
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

  const { data: enrollmentsData, isLoading, isFetching } = trpc.enrollment.listByStudent.useQuery(
    { time: timeTab, page, pageSize: ITEMS_PER_PAGE },
    // Keep the current rows on screen (dimmed) while the next tab/page loads
    // instead of blanking to a skeleton — makes tab switches feel instant.
    { placeholderData: keepPreviousData },
  );
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

  // When cancellation is locked, the reason shown as a tooltip on the (disabled)
  // cancel button — hover on desktop, tap on mobile.
  const lockedHint = (enrollment: {
    session: { startsAt: Date; school: { cancellationNoticeHours: number } };
  }) =>
    isWithinNoticeWindow(enrollment)
      ? t("enrollments.cancellationLockedHint", { hours: enrollment.session.school.cancellationNoticeHours })
      : undefined;

  useEffect(() => setPage(1), [timeTab]);

  // Warm the inactive tab so switching to it is instant (only two tabs, both cheap).
  const otherTab = timeTab === "current" ? "past" : "current";
  useEffect(() => {
    utils.enrollment.listByStudent.prefetch({ time: otherTab, page: 1, pageSize: ITEMS_PER_PAGE });
  }, [otherTab, utils]);

  return (
    <div className="space-y-4">
      {/* Title is shown in the mobile shell's curved header */}
      <div className="flex items-center justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Time tabs */}
      <SegmentedTabs
        value={timeTab}
        onChange={setTimeTab}
        options={[
          { value: "current", label: t("classes.upcoming") },
          { value: "past", label: t("classes.past") },
        ]}
      />

      {isLoading ? (
        <CardListSkeleton />
      ) : total === 0 ? (
        <EmptyState icon={ClipboardList} message={t("common.noResults")} />
      ) : view === "cards" ? (
        <div className={`grid gap-3 animate-in fade-in duration-300 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
          {paginatedEnrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="rounded-xl border bg-card p-4 card-shadow"
            >
              <div className="flex items-start gap-3">
                <IconTile icon={BookOpen} className={classTypeColorMap[enrollment.session.classType]} />
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
                      <InfoTooltip className="w-full" content={lockedHint(enrollment)}>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          disabled={cancelMutation.isPending || isWithinNoticeWindow(enrollment)}
                          onClick={() => setConfirmCancelId(enrollment.id)}
                        >
                          {t("enrollments.cancel")}
                        </Button>
                      </InfoTooltip>
                    </div>
                  )}
                </div>
                {canCancel(enrollment) && (
                  <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-1 shrink-0">
                    <InfoTooltip content={lockedHint(enrollment)}>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={cancelMutation.isPending || isWithinNoticeWindow(enrollment)}
                        onClick={() => setConfirmCancelId(enrollment.id)}
                      >
                        {t("enrollments.cancel")}
                      </Button>
                    </InfoTooltip>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTableCard className={`animate-in fade-in duration-300 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
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
                        <InfoTooltip content={lockedHint(enrollment)}>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={cancelMutation.isPending || isWithinNoticeWindow(enrollment)}
                            onClick={() => setConfirmCancelId(enrollment.id)}
                          >
                            {t("enrollments.cancel")}
                          </Button>
                        </InfoTooltip>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
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
