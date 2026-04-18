"use client";

import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { typeKeys, statusKeys, enrollmentStatusKeys } from "@/lib/constants/class";
import { toast } from "sonner";

export function ClassDetailDialog({
  classId,
  open,
  onClose,
  userRole,
}: {
  classId: string | null;
  open: boolean;
  onClose: () => void;
  userRole: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const utils = trpc.useUtils();

  const { data: classDetail } = trpc.class.getById.useQuery(
    { id: classId! },
    { enabled: !!classId }
  );

  const enrollMutation = trpc.enrollment.enroll.useMutation({
    onSuccess: () => {
      toast.success("Inscrito com sucesso");
      utils.class.getById.invalidate({ id: classId! });
      utils.class.list.invalidate();
      utils.enrollment.listByStudent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelEnrollmentMutation = trpc.enrollment.cancel.useMutation({
    onSuccess: () => {
      toast.success("Inscrição cancelada");
      utils.class.getById.invalidate({ id: classId! });
      utils.class.list.invalidate();
      utils.enrollment.listByStudent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const markAttendanceMutation = trpc.enrollment.markAttendance.useMutation({
    onSuccess: () => {
      toast.success("Presença registada");
      utils.class.getById.invalidate({ id: classId! });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const instructorUnavailableMutation = trpc.class.instructorUnavailable.useMutation({
    onSuccess: () => {
      toast.success("Aula cancelada — indisponibilidade registada");
      utils.class.getById.invalidate({ id: classId! });
      utils.class.list.invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!classDetail) return null;

  const isFull = classDetail.enrollments.filter((e) => e.status === "ENROLLED").length >= classDetail.capacity;
  const canEnroll = userRole === "STUDENT" && classDetail.status === "SCHEDULED" && !isFull;
  const canManageAttendance = ["ADMIN", "SECRETARY", "INSTRUCTOR"].includes(userRole);
  const canManage = ["ADMIN", "SECRETARY"].includes(userRole);
  const isInstructor = userRole === "INSTRUCTOR";

  // Check if current student is already enrolled
  const myEnrollment = classDetail.enrollments.find(
    (e) => e.status === "ENROLLED"
  );

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{classDetail.title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {t(typeKeys[classDetail.classType])}
            </Badge>
            <Badge variant={classDetail.status === "CANCELLED" ? "destructive" : "outline"}>
              {t(statusKeys[classDetail.status])}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">{t("classes.instructor")}: </span>
              {classDetail.instructor.name}
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
              <h4 className="font-medium">{t("nav.students")}</h4>
              <div className="space-y-1">
                {classDetail.enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span>{enrollment.student.name}</span>
                      <Badge
                        variant={enrollment.status === "ENROLLED" ? "default" : enrollment.status === "ATTENDED" ? "secondary" : "destructive"}
                      >
                        {t(enrollmentStatusKeys[enrollment.status] ?? enrollment.status)}
                      </Badge>
                    </div>
                    {enrollment.status === "ENROLLED" && (
                      <div className="flex gap-1">
                        {canManageAttendance && (
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
                              {t("enrollment.attended")}
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
                              {t("enrollment.noShow")}
                            </Button>
                          </>
                        )}
                        {canManage && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={cancelEnrollmentMutation.isPending}
                            onClick={() => cancelEnrollmentMutation.mutate({
                              enrollmentId: enrollment.id,
                            })}
                          >
                            {t("enrollment.remove")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {/* Student: enroll or cancel */}
          {userRole === "STUDENT" && classDetail.status === "SCHEDULED" && (
            <>
              {myEnrollment ? (
                <Button
                  variant="destructive"
                  disabled={cancelEnrollmentMutation.isPending}
                  onClick={() => cancelEnrollmentMutation.mutate({
                    enrollmentId: myEnrollment.id,
                  })}
                >
                  {cancelEnrollmentMutation.isPending ? t("common.loading") : t("enrollment.cancel")}
                </Button>
              ) : canEnroll ? (
                <Button
                  disabled={enrollMutation.isPending}
                  onClick={() => enrollMutation.mutate({ sessionId: classDetail.id })}
                >
                  {enrollMutation.isPending ? t("common.loading") : t("enrollment.enroll")}
                </Button>
              ) : isFull ? (
                <Badge variant="destructive">{t("enrollment.classFull")}</Badge>
              ) : null}
            </>
          )}
          {/* Instructor: flag unavailable */}
          {isInstructor && classDetail.status === "SCHEDULED" && (
            <Button
              variant="destructive"
              disabled={instructorUnavailableMutation.isPending}
              onClick={() => instructorUnavailableMutation.mutate({ id: classDetail.id })}
            >
              {instructorUnavailableMutation.isPending ? t("common.loading") : t("classes.markUnavailable")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.back")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
