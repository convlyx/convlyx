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
import { LICENSE_CATEGORIES, type LicenseCategory } from "@/lib/license-categories";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";

type Props = {
  studentId: string;
  /** Categories the student already has an in-progress course for; excluded from the picker. */
  excludeCategories?: readonly LicenseCategory[];
  open: boolean;
  onClose: () => void;
};

export function StartCourseDialog({ studentId, excludeCategories, open, onClose }: Props) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<LicenseCategory | "">("");

  const startMutation = trpc.course.start.useMutation({
    onSuccess: () => {
      toast.success(t("toast.courseStarted"));
      utils.user.studentOverview.invalidate({ id: studentId });
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setCategory(""); onClose(); } }}>
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
              allowedCategories={LICENSE_CATEGORIES.filter(
                (c) => !excludeCategories?.includes(c),
              )}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setCategory(""); onClose(); }}>{t("common.cancel")}</Button>
          <Button onClick={onSubmit} disabled={!category || startMutation.isPending}>
            {startMutation.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
