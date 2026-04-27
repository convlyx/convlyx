"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
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
import { StudentPicker } from "@/components/student-picker";
import { DatePicker, TimePicker } from "@/components/date-picker";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";

const createClassFormSchema = z.object({
  classType: z.enum(["THEORY", "PRACTICAL"]),
  schoolId: z.string().min(1, "Selecione uma escola"),
  instructorId: z.string().min(1, "Selecione um instrutor"),
  title: z.string().min(1, "O título é obrigatório"),
  capacity: z.number().int().min(1, "A capacidade deve ser pelo menos 1"),
  date: z.string(),
  startTime: z.string().min(1, "Selecione hora de início"),
  endTime: z.string().min(1, "Selecione hora de fim"),
  validFrom: z.string(),
  validUntil: z.string(),
});

type CreateClassFormData = z.infer<typeof createClassFormSchema>;

type ScheduleMode = "one-off" | "recurring";
const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

export function CreateClassDialog() {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const [open, setOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("one-off");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const utils = trpc.useUtils();

  const { data: schools, isLoading: schoolsLoading } = trpc.school.list.useQuery();
  const { data: instructors, isLoading: instructorsLoading } = trpc.user.list.useQuery({ role: "INSTRUCTOR", status: "ACTIVE" });
  const { data: students, isLoading: studentsLoading } = trpc.user.list.useQuery({ role: "STUDENT", status: "ACTIVE" });
  const dataLoading = schoolsLoading || instructorsLoading || studentsLoading;

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors } } = useForm<CreateClassFormData>({
    resolver: zodResolver(createClassFormSchema),
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

  // Auto-set capacity when switching class type
  const classType = watch("classType");
  useEffect(() => {
    if (classType === "PRACTICAL") {
      setValue("capacity", 1);
      setSelectedStudents([]);
    } else {
      setValue("capacity", 20);
      setSelectedStudents([]);
    }
  }, [classType, setValue]);

  // Auto-select when only one option
  const schoolId = watch("schoolId");
  const instructorId = watch("instructorId");
  useEffect(() => {
    if (!schoolId && schools?.length === 1) setValue("schoolId", schools[0].id);
  }, [schools, schoolId, setValue]);
  useEffect(() => {
    if (!instructorId && instructors?.length === 1) setValue("instructorId", instructors[0].id);
  }, [instructors, instructorId, setValue]);

  const createMutation = trpc.class.create.useMutation({
    onSuccess: () => {
      toast.success(t("toast.classCreated"));
      utils.class.list.invalidate();
      setOpen(false);
      reset();
      setScheduleMode("one-off");
      setSelectedDays([]);
      setSelectedStudents([]);
    },
    onError,
  });

  function onSubmit(data: CreateClassFormData) {
    const studentIds = data.classType === "PRACTICAL" && selectedStudents.length > 0
      ? selectedStudents
      : undefined;

    if (scheduleMode === "recurring") {
      createMutation.mutate({
        classType: data.classType,
        schoolId: data.schoolId,
        instructorId: data.instructorId,
        title: data.title,
        capacity: data.capacity,
        studentIds,
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
        studentIds,
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
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <DialogBody>
              <div className="grid gap-4">
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

            {/* School is auto-set from the user's school — hidden field */}
            <input type="hidden" {...register("schoolId")} />

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
              {errors.instructorId && <p className="text-sm text-destructive">{errors.instructorId.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="class-title">{t("common.name")}</Label>
              <Input id="class-title" {...register("title")} />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="class-capacity">{t("classes.capacity")}</Label>
              {watch("classType") === "PRACTICAL" ? (
                <Controller
                  control={control}
                  name="capacity"
                  render={({ field }) => {
                    const val = field.value <= 2 ? String(field.value) : "1";
                    return (
                      <Select value={val} onValueChange={(v) => field.onChange(Number(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 {t("nav.students").toLowerCase()}</SelectItem>
                          <SelectItem value="2">2 {t("nav.students").toLowerCase()}</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                  }}
                />
              ) : (
                <Input id="class-capacity" type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
              )}
              {errors.capacity && <p className="text-sm text-destructive">{errors.capacity.message}</p>}
            </div>

            {/* Student assignment — only for practical classes */}
            {watch("classType") === "PRACTICAL" && students && students.length > 0 && (
              <div className="grid gap-2">
                <Label>{t("classes.assignStudents")}</Label>
                <StudentPicker
                  students={students}
                  selected={selectedStudents}
                  onChange={setSelectedStudents}
                  max={watch("capacity")}
                />
              </div>
            )}

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
                  <Label>{t("classes.date")}</Label>
                  <Controller
                    control={control}
                    name="date"
                    render={({ field }) => (
                      <DatePicker value={field.value} onChange={field.onChange} />
                    )}
                  />
                  {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t("classes.startTime")}</Label>
                    <Controller
                      control={control}
                      name="startTime"
                      render={({ field }) => (
                        <TimePicker value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("classes.endTime")}</Label>
                    <Controller
                      control={control}
                      name="endTime"
                      render={({ field }) => (
                        <TimePicker value={field.value} onChange={field.onChange} />
                      )}
                    />
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
                    <Label>{t("classes.startTime")}</Label>
                    <Controller
                      control={control}
                      name="startTime"
                      render={({ field }) => (
                        <TimePicker value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("classes.endTime")}</Label>
                    <Controller
                      control={control}
                      name="endTime"
                      render={({ field }) => (
                        <TimePicker value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t("classes.validFrom")}</Label>
                    <Controller
                      control={control}
                      name="validFrom"
                      render={({ field }) => (
                        <DatePicker value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("classes.validUntil")}</Label>
                    <Controller
                      control={control}
                      name="validUntil"
                      render={({ field }) => (
                        <DatePicker value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                </div>
              </>
            )}

              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || dataLoading}>
                {createMutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
