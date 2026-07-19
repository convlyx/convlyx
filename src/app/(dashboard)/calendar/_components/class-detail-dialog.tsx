"use client";

import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InfoTooltip } from "@/components/info-tooltip";
import { typeKeys, statusKeys, statusVariant, enrollmentStatusKeys, enrollmentStatusVariant, classTypeBadgeClass, resolveEnrollmentDisplay, studentCanSelfEnroll, effectiveClassStatus } from "@/lib/constants/class";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { EditClassDialog } from "@/app/(dashboard)/classes/_components/edit-class-dialog";
import { Pencil, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { useState } from "react";
import Link from "next/link";
import { ProfileLink } from "@/components/profile-link";
import type { UserRole } from "@/generated/prisma/enums";

export function ClassDetailDialog({
  classId,
  open,
  onClose,
  userRole,
  userId,
}: {
  classId: string | null;
  open: boolean;
  onClose: () => void;
  userRole: UserRole;
  userId: string;
}) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const format = useFormatter();
  const utils = trpc.useUtils();
  const [confirmRemoveEnrollmentId, setConfirmRemoveEnrollmentId] = useState<string | null>(null);
  const [confirmCancelOwn, setConfirmCancelOwn] = useState(false);
  const [confirmUnavailable, setConfirmUnavailable] = useState(false);
  const [confirmCancelClass, setConfirmCancelClass] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const { data: classDetail } = trpc.class.getById.useQuery(
    { id: classId! },
    { enabled: !!classId }
  );

  const enrollMutation = trpc.enrollment.enroll.useMutation({
    onSuccess: () => {
      toast.success(t("toast.enrollmentSuccess"));
      utils.class.getById.invalidate({ id: classId! });
      utils.class.list.invalidate();
      utils.enrollment.listByStudent.invalidate();
    },
    onError,
  });

  const cancelEnrollmentMutation = trpc.enrollment.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.enrollmentCancelled"));
      utils.class.getById.invalidate({ id: classId! });
      utils.class.list.invalidate();
      utils.enrollment.listByStudent.invalidate();
    },
    onError,
  });

  const markAttendanceMutation = trpc.enrollment.markAttendance.useMutation({
    onSuccess: () => {
      toast.success(t("toast.attendanceRecorded"));
      utils.class.getById.invalidate({ id: classId! });
    },
    onError,
  });

  const instructorUnavailableMutation = trpc.class.instructorUnavailable.useMutation({
    onSuccess: () => {
      toast.success(t("toast.instructorUnavailable"));
      utils.class.getById.invalidate({ id: classId! });
      utils.class.list.invalidate();
      onClose();
    },
    onError,
  });

  const cancelClassMutation = trpc.class.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.classCancelled"));
      utils.class.getById.invalidate({ id: classId! });
      utils.class.list.invalidate();
      setConfirmCancelClass(false);
      onClose();
    },
    onError,
  });

  const bulkAttendanceMutation = trpc.enrollment.bulkMarkAttendance.useMutation({
    onSuccess: () => {
      toast.success(t("enrollments.allMarkedPresent"));
      utils.class.getById.invalidate({ id: classId! });
    },
    onError,
  });

  const addNoteMutation = trpc.enrollment.addNote.useMutation({
    onSuccess: () => {
      toast.success(t("enrollments.noteSaved"));
      utils.class.getById.invalidate({ id: classId! });
      setEditingNoteId(null);
      setNoteText("");
    },
    onError,
  });

  if (!classDetail) return null;

  // Derived live lifecycle status — class rows aren't cron-transitioned.
  const liveStatus = effectiveClassStatus(classDetail);
  const isFull = classDetail.enrollments.filter((e) => e.status === "ENROLLED").length >= classDetail.capacity;
  const canEnroll =
    userRole === "STUDENT" &&
    liveStatus === "SCHEDULED" &&
    !isFull &&
    studentCanSelfEnroll(classDetail);
  const canMarkAttendance = ["ADMIN", "SECRETARY", "INSTRUCTOR"].includes(userRole)
    && (liveStatus === "IN_PROGRESS" || liveStatus === "COMPLETED");
  const canManage = userRole === "ADMIN" || userRole === "SECRETARY";
  const isInstructor = userRole === "INSTRUCTOR";
  const isActive = liveStatus === "SCHEDULED" || liveStatus === "IN_PROGRESS";
  const enrolledCount = classDetail.enrollments.filter((e) => e.status === "ENROLLED").length;

  // Check if current student is already enrolled
  const myEnrollment = classDetail.enrollments.find(
    (e) => e.status === "ENROLLED" && e.student.id === userId,
  );

  // Whether a student's self-cancellation is blocked by the school's notice window
  const noticeHours = classDetail.school.cancellationNoticeHours;
  const nowMs = new Date().getTime();
  const isWithinNoticeWindow =
    noticeHours > 0 &&
    classDetail.startsAt.getTime() - nowMs <
      noticeHours * 3600_000;

  // A theory class currently within its time window — show the QR check-in link.
  const isOccurring =
    liveStatus !== "CANCELLED" &&
    classDetail.startsAt.getTime() <= nowMs &&
    classDetail.endsAt.getTime() >= nowMs;
  const canOpenCheckIn =
    classDetail.classType === "THEORY" && (canManage || isInstructor) && isOccurring;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{classDetail.title}</DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div className="grid gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge className={classTypeBadgeClass[classDetail.classType]}>
              {t(typeKeys[classDetail.classType])}
            </Badge>
            <Badge variant={statusVariant[liveStatus] ?? "outline"}>
              {t(statusKeys[liveStatus])}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">{t("classes.instructor")}: </span>
              <ProfileLink
                type="instructor"
                id={classDetail.instructor.id}
                name={classDetail.instructor.name}
                userRole={userRole}
                onNavigate={onClose}
              />
            </div>
            <div>
              <span className="text-muted-foreground">{t("common.school")}: </span>
              {classDetail.school.name}
            </div>
            <div>
              <span className="text-muted-foreground">{t("classes.date")}: </span>
              {format.dateTime(new Date(classDetail.startsAt), {
                day: "2-digit", month: "2-digit", year: "numeric",
              })}
            </div>
            <div>
              <span className="text-muted-foreground">{t("classes.startTime")}: </span>
              {format.dateTime(new Date(classDetail.startsAt), {
                hour: "2-digit", minute: "2-digit",
              })}
              {" · "}
              {format.dateTime(new Date(classDetail.endsAt), {
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
            <div>
              <span className="text-muted-foreground">{t("classes.capacity")}: </span>
              {classDetail.enrollments.filter((e) => e.status === "ENROLLED").length}/{classDetail.capacity}
            </div>
          </div>

          {/* Enrollment list */}
          {classDetail.enrollments.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium">{t("nav.students")}</h4>
                {canMarkAttendance && enrolledCount > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={bulkAttendanceMutation.isPending}
                    onClick={() => bulkAttendanceMutation.mutate({ sessionId: classDetail.id, status: "ATTENDED" })}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {t("enrollments.markAllPresent")}
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {classDetail.enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="py-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ProfileLink
                          type="student"
                          id={enrollment.student.id}
                          name={enrollment.student.name}
                          userRole={userRole}
                          onNavigate={onClose}
                        />
                        {(() => {
                          const displayStatus = resolveEnrollmentDisplay(enrollment.status, liveStatus);
                          return (
                            <Badge variant={enrollmentStatusVariant[displayStatus] ?? "outline"}>
                              {t(enrollmentStatusKeys[displayStatus] ?? displayStatus)}
                            </Badge>
                          );
                        })()}
                      </div>
                      {enrollment.status === "ENROLLED" && (
                        <div className="flex gap-1">
                          {canMarkAttendance && (
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
                                {t("enrollments.attended")}
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
                                {t("enrollments.noShow")}
                              </Button>
                            </>
                          )}
                          {isInstructor && (
                            <Button
                              size="icon-sm"
                              variant="outline"
                              onClick={() => { setEditingNoteId(enrollment.id); setNoteText(enrollment.notes ?? ""); }}
                              title={enrollment.notes ? t("enrollments.editNote") : t("enrollments.addNote")}
                              aria-label={enrollment.notes ? t("enrollments.editNote") : t("enrollments.addNote")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={cancelEnrollmentMutation.isPending}
                              onClick={() => setConfirmRemoveEnrollmentId(enrollment.id)}
                            >
                              {t("enrollments.remove")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Instructor note — display + inline edit (mirrors the class detail page) */}
                    {editingNoteId === enrollment.id ? (
                      <div className="mt-2 space-y-1.5">
                        <Textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder={t("enrollments.notePlaceholder")}
                          className="text-xs min-h-[60px]"
                        />
                        <div className="flex gap-1.5">
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
                      enrollment.notes && (
                        <p className="mt-1 text-xs text-muted-foreground italic">{enrollment.notes}</p>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </DialogBody>

        <DialogFooter>
          {/* Student: enroll or cancel */}
          {userRole === "STUDENT" && liveStatus === "SCHEDULED" && (
            <>
              {myEnrollment ? (
                <InfoTooltip content={isWithinNoticeWindow ? t("enrollments.cancellationLockedHint", { hours: noticeHours }) : undefined}>
                  <Button
                    variant="destructive"
                    disabled={cancelEnrollmentMutation.isPending || isWithinNoticeWindow}
                    onClick={() => setConfirmCancelOwn(true)}
                  >
                    {cancelEnrollmentMutation.isPending ? t("common.loading") : t("enrollments.cancel")}
                  </Button>
                </InfoTooltip>
              ) : canEnroll ? (
                <Button
                  disabled={enrollMutation.isPending}
                  onClick={() => enrollMutation.mutate({ sessionId: classDetail.id })}
                >
                  {enrollMutation.isPending ? t("common.loading") : t("enrollments.enroll")}
                </Button>
              ) : isFull ? (
                <Badge variant="destructive">{t("enrollments.classFull")}</Badge>
              ) : null}
            </>
          )}
          {/* Check-in (theory, happening now) for instructor + staff */}
          {canOpenCheckIn && (
            <Link href={`/checkin-display/${classDetail.id}`} className={buttonVariants()}>
              {t("checkin.bannerAction")}
            </Link>
          )}
          {/* Instructor: flag unavailable — only before the class starts */}
          {isInstructor && liveStatus === "SCHEDULED" && classDetail.startsAt.getTime() > nowMs && (
            <Button
              variant="destructive"
              disabled={instructorUnavailableMutation.isPending}
              onClick={() => setConfirmUnavailable(true)}
            >
              {instructorUnavailableMutation.isPending ? t("common.loading") : t("classes.markUnavailable")}
            </Button>
          )}
          {/* Staff: edit + cancel — parity with the classes list and detail page */}
          {canManage && isActive && (
            <>
              <Button variant="outline" onClick={() => setShowEdit(true)}>
                {t("common.edit")}
              </Button>
              <Button
                variant="destructive"
                disabled={cancelClassMutation.isPending}
                onClick={() => setConfirmCancelClass(true)}
              >
                {t("classes.cancelClass")}
              </Button>
            </>
          )}
          {userRole !== "STUDENT" && (
            <Link href={`/classes/${classDetail.id}`} className={buttonVariants({ variant: "outline" })}>
              {t("classes.viewDetails")}
            </Link>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.back")}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmRemoveEnrollmentId !== null}
        onClose={() => setConfirmRemoveEnrollmentId(null)}
        onConfirm={() => {
          if (confirmRemoveEnrollmentId) cancelEnrollmentMutation.mutate({ enrollmentId: confirmRemoveEnrollmentId });
          setConfirmRemoveEnrollmentId(null);
        }}
        title={t("classes.removeStudentTitle")}
        message={t("classes.removeStudentMessage")}
        loading={cancelEnrollmentMutation.isPending}
      />

      <ConfirmDialog
        open={confirmCancelOwn}
        onClose={() => setConfirmCancelOwn(false)}
        onConfirm={() => {
          if (myEnrollment) cancelEnrollmentMutation.mutate({ enrollmentId: myEnrollment.id });
          setConfirmCancelOwn(false);
        }}
        title={t("classes.cancelOwnEnrollmentTitle")}
        message={t("classes.cancelOwnEnrollmentMessage")}
        loading={cancelEnrollmentMutation.isPending}
      />

      <ConfirmDialog
        open={confirmUnavailable}
        onClose={() => setConfirmUnavailable(false)}
        onConfirm={() => {
          instructorUnavailableMutation.mutate({ id: classDetail.id });
          setConfirmUnavailable(false);
        }}
        title={t("classes.unavailableConfirmTitle")}
        message={t("classes.unavailableConfirmMessage")}
        loading={instructorUnavailableMutation.isPending}
      />

      <ConfirmDialog
        open={confirmCancelClass}
        onClose={() => setConfirmCancelClass(false)}
        onConfirm={() => cancelClassMutation.mutate({ id: classDetail.id })}
        title={t("common.confirm")}
        message={t("classes.cancelConfirm")}
        loading={cancelClassMutation.isPending}
      />

      {showEdit && (
        <EditClassDialog
          classData={classDetail}
          open={showEdit}
          onClose={() => {
            setShowEdit(false);
            utils.class.getById.invalidate({ id: classDetail.id });
          }}
        />
      )}
    </Dialog>
  );
}
