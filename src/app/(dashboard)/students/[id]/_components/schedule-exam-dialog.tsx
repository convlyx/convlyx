"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { DatePicker, TimePicker } from "@/components/date-picker";
import { lisbonWallClockToISO } from "@/lib/dates";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import type { LicenseCategory } from "@/lib/license-categories";

type Props = {
  studentId: string;
  courseId: string;
  category: LicenseCategory;
  open: boolean;
  onClose: () => void;
};

export function ScheduleExamDialog({ studentId, courseId, category, open, onClose }: Props) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();

  const [type, setType] = useState<"THEORY" | "PRACTICAL">("THEORY");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [instructorId, setInstructorId] = useState<string>("");

  const { data: instructorsData } = trpc.user.list.useQuery({
    role: "INSTRUCTOR",
    status: "ACTIVE",
  });
  const instructors = instructorsData?.items;

  const filteredInstructors = instructors?.filter((i) =>
    !i.qualifiedCategories?.length || i.qualifiedCategories.includes(category)
  ) ?? [];

  const scheduleMutation = trpc.exam.schedule.useMutation({
    onSuccess: () => {
      toast.success(t("toast.examScheduled"));
      utils.user.studentProfile.invalidate({ id: studentId });
      utils.course.listByStudent.invalidate({ studentId });
      utils.exam.list.invalidate();
      reset();
      onClose();
    },
    onError,
  });

  function reset() {
    setType("THEORY");
    setDate("");
    setTime("09:00");
    setLocation("");
    setInstructorId("");
  }

  function onSubmit() {
    if (!date || !time) return;
    scheduleMutation.mutate({
      courseId,
      type,
      scheduledAt: lisbonWallClockToISO(date, time),
      location: location || undefined,
      instructorId: instructorId || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("exams.schedule")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("exams.examType")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as "THEORY" | "PRACTICAL")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THEORY">{t("exams.theory")}</SelectItem>
                  <SelectItem value="PRACTICAL">{t("exams.practical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("classes.date")}</Label>
                <DatePicker value={date} onChange={setDate} />
              </div>
              <div className="grid gap-2">
                <Label>{t("classes.startTime")}</Label>
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exam-location">{t("exams.location")}</Label>
              <Input
                id="exam-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("exams.locationPlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t("exams.accompanyingInstructorOptional")}</Label>
              <Select value={instructorId || "NONE"} onValueChange={(v) => setInstructorId(v === "NONE" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">{t("exams.noAccompany")}</SelectItem>
                  {filteredInstructors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>{t("common.cancel")}</Button>
          <Button onClick={onSubmit} disabled={!date || scheduleMutation.isPending}>
            {scheduleMutation.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
