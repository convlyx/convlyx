"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";

type ScheduleMode = "one-off" | "recurring";
const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

export function CreateClassDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("one-off");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const utils = trpc.useUtils();

  const { data: schools } = trpc.school.list.useQuery();
  const { data: instructors } = trpc.user.list.useQuery({ role: "INSTRUCTOR" });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    defaultValues: {
      classType: "THEORY" as "THEORY" | "PRACTICAL",
      schoolId: "",
      instructorId: "",
      title: "",
      capacity: 20,
      date: "",
      startTime: "09:00",
      endTime: "10:00",
      validFrom: "",
      validUntil: "",
    },
  });

  const createMutation = trpc.class.create.useMutation({
    onSuccess: () => {
      utils.class.list.invalidate();
      setOpen(false);
      reset();
      setScheduleMode("one-off");
      setSelectedDays([]);
    },
  });

  function onSubmit(data: {
    classType: "THEORY" | "PRACTICAL";
    schoolId: string;
    instructorId: string;
    title: string;
    capacity: number;
    date: string;
    startTime: string;
    endTime: string;
    validFrom: string;
    validUntil: string;
  }) {
    if (scheduleMode === "recurring") {
      createMutation.mutate({
        classType: data.classType,
        schoolId: data.schoolId,
        instructorId: data.instructorId,
        title: data.title,
        capacity: data.capacity,
        startsAt: new Date(`${data.validFrom}T${data.startTime}:00`).toISOString(),
        endsAt: new Date(`${data.validFrom}T${data.endTime}:00`).toISOString(),
        recurrence: {
          daysOfWeek: selectedDays,
          startTime: data.startTime,
          endTime: data.endTime,
          validFrom: data.validFrom,
          validUntil: data.validUntil,
        },
      });
    } else {
      createMutation.mutate({
        classType: data.classType,
        schoolId: data.schoolId,
        instructorId: data.instructorId,
        title: data.title,
        capacity: data.capacity,
        startsAt: new Date(`${data.date}T${data.startTime}:00`).toISOString(),
        endsAt: new Date(`${data.date}T${data.endTime}:00`).toISOString(),
      });
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("classes.create")}</Button>
      <Dialog
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) { reset(); setScheduleMode("one-off"); setSelectedDays([]); }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("classes.create")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("classes.type")}</Label>
              <Controller
                control={control}
                name="classType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="THEORY">{t("classes.theory")}</SelectItem>
                      <SelectItem value="PRACTICAL">{t("classes.practical")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t("common.school")}</Label>
              <Controller
                control={control}
                name="schoolId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("common.school")} />
                    </SelectTrigger>
                    <SelectContent>
                      {schools?.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t("classes.instructor")}</Label>
              <Controller
                control={control}
                name="instructorId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("classes.instructor")} />
                    </SelectTrigger>
                    <SelectContent>
                      {instructors?.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {instructor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="class-title">{t("common.name")}</Label>
              <Input id="class-title" {...register("title")} />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="class-capacity">{t("classes.capacity")}</Label>
              <Input id="class-capacity" type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant={scheduleMode === "one-off" ? "default" : "outline"} size="sm" onClick={() => setScheduleMode("one-off")}>
                {t("classes.oneOff")}
              </Button>
              <Button type="button" variant={scheduleMode === "recurring" ? "default" : "outline"} size="sm" onClick={() => setScheduleMode("recurring")}>
                {t("classes.recurring")}
              </Button>
            </div>

            {scheduleMode === "one-off" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="class-date">{t("classes.date")}</Label>
                  <Input id="class-date" type="date" {...register("date")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="class-start">{t("classes.startTime")}</Label>
                    <Input id="class-start" type="time" {...register("startTime")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="class-end">{t("classes.endTime")}</Label>
                    <Input id="class-end" type="time" {...register("endTime")} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>{t("classes.daysOfWeek")}</Label>
                  <div className="flex flex-wrap gap-3">
                    {DAYS_OF_WEEK.map((day) => (
                      <label key={day} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDays.includes(day)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDays((prev) => [...prev, day]);
                            } else {
                              setSelectedDays((prev) => prev.filter((d) => d !== day));
                            }
                          }}
                          className="accent-primary"
                        />
                        {t(`days.${day}`)}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="class-start-r">{t("classes.startTime")}</Label>
                    <Input id="class-start-r" type="time" {...register("startTime")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="class-end-r">{t("classes.endTime")}</Label>
                    <Input id="class-end-r" type="time" {...register("endTime")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="class-from">{t("classes.validFrom")}</Label>
                    <Input id="class-from" type="date" {...register("validFrom")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="class-until">{t("classes.validUntil")}</Label>
                    <Input id="class-until" type="date" {...register("validUntil")} />
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
