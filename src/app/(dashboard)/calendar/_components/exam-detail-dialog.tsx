"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/category-badge";
import { Loading } from "@/components/loading";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProfileLink } from "@/components/profile-link";
import { CalendarDays, MapPin, User as UserIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import type { UserRole } from "@/generated/prisma/enums";

const RESULT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SCHEDULED: "secondary",
  PASSED: "default",
  FAILED: "destructive",
  NO_SHOW: "destructive",
  CANCELLED: "outline",
};

const RESULT_KEYS: Record<string, string> = {
  SCHEDULED: "exams.scheduledStatus",
  PASSED: "exams.passedStatus",
  FAILED: "exams.failedStatus",
  NO_SHOW: "exams.noShowStatus",
  CANCELLED: "exams.cancelledStatus",
};

export function ExamDetailDialog({
  examId,
  open,
  onClose,
  onRequestRecordResult,
  userRole,
  userId,
}: {
  examId: string | null;
  open: boolean;
  onClose: () => void;
  /** Called when user clicks "Registar resultado" — parent should close this and open the record dialog */
  onRequestRecordResult: (examId: string, studentId: string) => void;
  userRole: UserRole;
  userId: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();
  const [showCancel, setShowCancel] = useState(false);

  const { data: exam, isLoading } = trpc.exam.getById.useQuery(
    { id: examId ?? "" },
    { enabled: !!examId, retry: false }
  );

  const cancelMutation = trpc.exam.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.examCancelled"));
      utils.exam.list.invalidate();
      utils.user.studentProfile.invalidate();
      setShowCancel(false);
      onClose();
    },
    onError,
  });

  const noShowMutation = trpc.exam.recordResult.useMutation({
    onSuccess: () => {
      toast.success(t("toast.examResultRecorded"));
      utils.exam.list.invalidate();
      utils.user.studentProfile.invalidate();
      onClose();
    },
    onError,
  });

  const canManage = userRole === "ADMIN" || userRole === "SECRETARY";
  const canMarkNoShow = userRole === "INSTRUCTOR" && exam?.instructor?.id === userId;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {exam ? t("exams.examFor", {
                type: exam.type === "THEORY" ? t("exams.theory") : t("exams.practical"),
                category: t(`categories.${exam.course.category}`),
              }) : t("exams.examLabel")}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {isLoading || !exam ? (
              <Loading />
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge category={exam.course.category} />
                  <Badge variant={RESULT_VARIANT[exam.result] ?? "outline"}>
                    {t(RESULT_KEYS[exam.result] ?? "exams.scheduledStatus")}
                  </Badge>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <UserIcon className="h-4 w-4 shrink-0 mt-0.5" />
                  <ProfileLink
                    type="student"
                    id={exam.course.student.id}
                    name={exam.course.student.name}
                    userRole={userRole}
                    onNavigate={onClose}
                  />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>
                    {format.dateTime(new Date(exam.scheduledAt), {
                      weekday: "long",
                      day: "2-digit", month: "long", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                {exam.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{exam.location}</span>
                  </div>
                )}
                {exam.instructor && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserIcon className="h-4 w-4 shrink-0" />
                    <ProfileLink
                      type="instructor"
                      id={exam.instructor.id}
                      name={exam.instructor.name}
                      userRole={userRole}
                      onNavigate={onClose}
                    />
                  </div>
                )}
                {exam.examinerNotes && (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("exams.examinerNotes")}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{exam.examinerNotes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            {exam && exam.result === "SCHEDULED" && (
              <>
                {canManage && (
                  <>
                    <Button variant="outline" onClick={() => setShowCancel(true)}>
                      {t("exams.cancelExam")}
                    </Button>
                    <Button
                      onClick={() => onRequestRecordResult(exam.id, exam.course.student.id)}
                      className="gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {t("exams.recordResult")}
                    </Button>
                  </>
                )}
                {canMarkNoShow && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      noShowMutation.mutate({ id: exam.id, result: "NO_SHOW" })
                    }
                    disabled={noShowMutation.isPending}
                  >
                    {t("exams.markNoShow")}
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" onClick={onClose}>{t("common.back")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showCancel}
        title={t("exams.cancelExam")}
        message={t("exams.cancelExamConfirm")}
        confirmLabel={t("common.confirm")}
        loading={cancelMutation.isPending}
        onConfirm={() => exam && cancelMutation.mutate({ id: exam.id })}
        onClose={() => setShowCancel(false)}
        variant="destructive"
      />
    </>
  );
}
