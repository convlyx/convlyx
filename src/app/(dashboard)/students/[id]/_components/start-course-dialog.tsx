"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CategorySelect } from "@/components/category-select";
import type { LicenseCategory } from "@/lib/license-categories";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";

type Props = {
  studentId: string;
  open: boolean;
  onClose: () => void;
};

export function StartCourseDialog({ studentId, open, onClose }: Props) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<LicenseCategory | "">("");

  const startMutation = trpc.course.start.useMutation({
    onSuccess: () => {
      toast.success(t("toast.courseStarted"));
      utils.user.studentProfile.invalidate({ id: studentId });
      utils.course.listByStudent.invalidate({ studentId });
      utils.course.currentForStudent.invalidate({ studentId });
      utils.user.list.invalidate();
      setCategory("");
      onClose();
    },
    onError,
  });

  function onSubmit() {
    if (!category) return;
    startMutation.mutate({ studentId, category });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("courses.startCourse")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-2">
            <Label>{t("classes.category")}</Label>
            <CategorySelect
              value={category}
              onChange={setCategory}
              placeholder={t("courses.selectCategory")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={onSubmit} disabled={!category || startMutation.isPending}>
            {startMutation.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
