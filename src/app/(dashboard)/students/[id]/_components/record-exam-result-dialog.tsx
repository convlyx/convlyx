"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";

type Props = {
  examId: string;
  studentId: string;
  open: boolean;
  onClose: () => void;
};

type ResultValue = "PASSED" | "FAILED" | "NO_SHOW" | "CANCELLED";

export function RecordExamResultDialog({ examId, studentId, open, onClose }: Props) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();
  const [result, setResult] = useState<ResultValue>("PASSED");
  const [notes, setNotes] = useState("");

  function reset() {
    setResult("PASSED");
    setNotes("");
  }

  const mutation = trpc.exam.recordResult.useMutation({
    onSuccess: () => {
      toast.success(t("toast.examResultRecorded"));
      utils.user.studentOverview.invalidate({ id: studentId });
      utils.course.listByStudent.invalidate({ studentId });
      utils.exam.list.invalidate();
      reset();
      onClose();
    },
    onError,
  });

  function onSubmit() {
    mutation.mutate({
      id: examId,
      result,
      examinerNotes: notes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("exams.recordResult")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("exams.result")}</Label>
              <Select value={result} onValueChange={(v) => setResult(v as ResultValue)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PASSED">{t("exams.markPassed")}</SelectItem>
                  <SelectItem value="FAILED">{t("exams.markFailed")}</SelectItem>
                  <SelectItem value="NO_SHOW">{t("exams.markNoShow")}</SelectItem>
                  <SelectItem value="CANCELLED">{t("exams.markCancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exam-notes">{t("exams.examinerNotes")}</Label>
              <Textarea
                id="exam-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("exams.examinerNotesPlaceholder")}
                rows={4}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>{t("common.cancel")}</Button>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
