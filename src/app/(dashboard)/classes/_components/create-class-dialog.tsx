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
import { CategorySelect } from "@/components/category-select";
import { LICENSE_CATEGORIES } from "@/lib/license-categories";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { lisbonWallClockToISO } from "@/lib/dates";
import { track } from "@/lib/posthog";

const createClassFormSchema = z
  .object({
    classType: z.enum(["THEORY", "PRACTICAL"]),
    // Theory classes don't pick a category (apply to all categories);
    // practical classes do. Required only when classType === "PRACTICAL".
    category: z.enum(LICENSE_CATEGORIES).optional(),
    schoolId: z.string().min(1, "Selecione uma escola"),
    instructorId: z.string().min(1, "Selecione um instrutor"),
    title: z.string().min(1, "O título é obrigatório"),
    capacity: z.number().int().min(1, "A capacidade deve ser pelo menos 1"),
    date: z.string(),
    startTime: z.string().min(1, "Selecione hora de início"),
    endTime: z.string().min(1, "Selecione hora de fim"),
    validFrom: z.string(),
    validUntil: z.string(),
  })
  .refine((d) => d.classType !== "PRACTICAL" || !!d.category, {
    message: "Selecione a categoria",
    path: ["category"],
  });

type CreateClassFormData = z.infer<typeof createClassFormSchema>;

type ScheduleMode = "one-off" | "recurring";
const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

type Prefill = {
  date?: string;
  startTime?: string;
  endTime?: string;
  instructorId?: string;
  classType?: "THEORY" | "PRACTICAL";
};

export function CreateClassDialog({
  userRole,
  userId,
  open: controlledOpen,
  onOpenChange,
  prefill,
  hideTrigger,
}: {
  userRole?: string;
  userId?: string;
  /** Optional: parent controls open state. Otherwise self-managed. */
  open?: boolean;
  onOpenChange?: (val: boolean) => void;
  /** Optional pre-filled date + start/end time, e.g. from a calendar click. */
  prefill?: Prefill;
  /** Hide the built-in "Criar aula" trigger button (e.g. when the parent
   *  opens the dialog from elsewhere like a calendar click). */
  hideTrigger?: boolean;
} = {}) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (isControlled) onOpenChange?.(val);
    else setInternalOpen(val);
  };
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("one-off");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const utils = trpc.useUtils();

  const isInstructor = userRole === "INSTRUCTOR";
  const isStaff = !userRole || userRole === "ADMIN" || userRole === "SECRETARY";

  const { data: schools, isLoading: schoolsLoading } = trpc.school.list.useQuery();
  const { data: instructorsData, isLoading: instructorsLoading } = trpc.user.list.useQuery(
    { role: "INSTRUCTOR", status: "ACTIVE" },
    { enabled: isStaff },
  );
  const instructors = instructorsData?.items;
  const { data: studentsData, isLoading: studentsLoading } = trpc.user.list.useQuery(
    { role: "STUDENT", status: "ACTIVE" },
  );
  const students = studentsData?.items;
  const dataLoading = schoolsLoading
    || studentsLoading
    || (isStaff && instructorsLoading);

  const { register, handleSubmit, reset, control, setValue, setError, getValues, watch, formState: { errors } } = useForm<CreateClassFormData>({
    resolver: zodResolver(createClassFormSchema),
    defaultValues: {
      classType: "THEORY" as "THEORY" | "PRACTICAL",
      category: undefined,
      schoolId: "",
      instructorId: isInstructor && userId ? userId : "",
      title: "",
      capacity: 20,
      date: "",
      startTime: "09:00",
      endTime: "10:00",
      validFrom: "",
      validUntil: "",
    },
  });

  // When the dialog is opened with a prefill (e.g. calendar click or active
  // filter), populate the matching fields. Runs only when prefill changes
  // (not on every form mutation) so user edits aren't clobbered.
  useEffect(() => {
    if (!open || !prefill) return;
    if (prefill.date !== undefined) {
      setScheduleMode("one-off");
      setValue("date", prefill.date);
    }
    if (prefill.startTime !== undefined) setValue("startTime", prefill.startTime);
    if (prefill.endTime !== undefined) setValue("endTime", prefill.endTime);
    if (prefill.instructorId !== undefined) setValue("instructorId", prefill.instructorId);
    if (prefill.classType !== undefined) setValue("classType", prefill.classType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill]);

  // Auto-set capacity when switching class type
  const classType = watch("classType");
  useEffect(() => {
    if (classType === "PRACTICAL") {
      setValue("capacity", 1);
      setSelectedStudents([]);
    } else {
      setValue("capacity", 20);
      setSelectedStudents([]);
      setValue("category", undefined);
    }
  }, [classType, setValue]);

  // Practical classes are scoped to a single category — only students whose
  // active StudentCourse matches the chosen category are eligible. Clear any
  // previously selected students when the category changes.
  const categoryWatched = watch("category");
  useEffect(() => {
    setSelectedStudents([]);
  }, [categoryWatched]);

  const eligibleStudents = students && categoryWatched
    ? students.filter((s) => s.currentCategory === categoryWatched)
    : [];

  // Auto-select when only one option
  const schoolId = watch("schoolId");
  const instructorId = watch("instructorId");
  const category = watch("category");
  useEffect(() => {
    if (!schoolId && schools?.length === 1) setValue("schoolId", schools[0].id);
  }, [schools, schoolId, setValue]);

  // When a category is chosen, only show instructors qualified for it
  const filteredInstructors = isStaff && category && instructors
    ? instructors.filter((i) =>
        !i.qualifiedCategories?.length || i.qualifiedCategories.includes(category)
      )
    : instructors;

  useEffect(() => {
    if (!instructorId && filteredInstructors?.length === 1) setValue("instructorId", filteredInstructors[0].id);
  }, [filteredInstructors, instructorId, setValue]);

  // Clear instructor if they're not qualified for the newly selected category
  useEffect(() => {
    if (!category || !instructorId || !instructors) return;
    const current = instructors.find((i) => i.id === instructorId);
    if (
      current &&
      current.qualifiedCategories?.length &&
      !current.qualifiedCategories.includes(category)
    ) {
      setValue("instructorId", "");
    }
  }, [category, instructorId, instructors, setValue]);

  const createMutation = trpc.class.create.useMutation({
    onSuccess: async (_data, vars) => {
      toast.success(t("toast.classCreated"));
      // Wait for the refetch to settle so the calendar/list shows the new
      // class before we close the dialog. Without `await`, the dialog closes
      // before React Query completes the refetch and the user has to refresh.
      await utils.class.list.invalidate();
      track("class_created", {
        class_type: vars.classType,
        recurring: !!vars.recurrence,
        capacity: vars.capacity,
      });
      setOpen(false);
      reset();
      setScheduleMode("one-off");
      setSelectedDays([]);
      setSelectedStudents([]);
    },
    onError,
  });

  // Schedule-related fields aren't required in the Zod schema (they belong to
  // different scheduling modes), so we validate them manually. Returns true
  // when the schedule slice of the form is valid; sets inline errors otherwise.
  function validateSchedule(): boolean {
    let ok = true;
    if (scheduleMode === "one-off") {
      if (!getValues("date")) {
        setError("date", { type: "required", message: t("classes.dateRequired") });
        ok = false;
      }
    } else {
      if (!getValues("validFrom")) {
        setError("validFrom", { type: "required", message: t("classes.validFromRequired") });
        ok = false;
      }
      if (!getValues("validUntil")) {
        setError("validUntil", { type: "required", message: t("classes.validUntilRequired") });
        ok = false;
      }
      if (selectedDays.length === 0) {
        toast.error(t("classes.daysOfWeekRequired"));
        ok = false;
      }
    }
    return ok;
  }

  function onSubmit(data: CreateClassFormData) {
    if (!validateSchedule()) return;

    const studentIds = data.classType === "PRACTICAL" && selectedStudents.length > 0
      ? selectedStudents
      : undefined;

    if (scheduleMode === "recurring") {
      createMutation.mutate({
        classType: data.classType,
        category: data.category,
        schoolId: data.schoolId,
        instructorId: data.instructorId,
        title: data.title,
        capacity: data.capacity,
        studentIds,
        startsAt: lisbonWallClockToISO(data.validFrom, data.startTime),
        endsAt: lisbonWallClockToISO(data.validFrom, data.endTime),
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
        category: data.category,
        schoolId: data.schoolId,
        instructorId: data.instructorId,
        title: data.title,
        capacity: data.capacity,
        studentIds,
        startsAt: lisbonWallClockToISO(data.date, data.startTime),
        endsAt: lisbonWallClockToISO(data.date, data.endTime),
      });
    }
  }

  return (
    <>
      {!hideTrigger && (
        <Button onClick={() => setOpen(true)}>{t("classes.create")}</Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) { reset(); setScheduleMode("one-off"); setSelectedDays([]); setSelectedStudents([]); }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("classes.create")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit, validateSchedule)} className="flex flex-col flex-1 min-h-0">
            <DialogBody>
              <div className="grid gap-4">
            <div className={classType === "PRACTICAL" ? "grid grid-cols-2 gap-4" : "grid"}>
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
              {classType === "PRACTICAL" && (
                <div className="grid gap-2">
                  <Label>{t("classes.category")}</Label>
                  <Controller
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <CategorySelect
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder={t("classes.categoryRequired")}
                      />
                    )}
                  />
                  {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                </div>
              )}
            </div>

            {/* School is auto-set from the user's school — hidden field */}
            <input type="hidden" {...register("schoolId")} />

            {isStaff ? (
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
                        {filteredInstructors?.map((instructor) => (
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
            ) : (
              <input type="hidden" {...register("instructorId")} />
            )}

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
                    const val = field.value >= 1 && field.value <= 4 ? String(field.value) : "1";
                    return (
                      <Select value={val} onValueChange={(v) => field.onChange(Number(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 {t("nav.students").toLowerCase()}</SelectItem>
                          <SelectItem value="2">2 {t("nav.students").toLowerCase()}</SelectItem>
                          <SelectItem value="3">3 {t("nav.students").toLowerCase()}</SelectItem>
                          <SelectItem value="4">4 {t("nav.students").toLowerCase()}</SelectItem>
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

            {/* Student assignment — only for practical classes, filtered to
                the selected category. Hidden until a category is picked. */}
            {watch("classType") === "PRACTICAL" && categoryWatched && (
              <div className="grid gap-2">
                <Label>{t("classes.assignStudents")}</Label>
                <StudentPicker
                  students={eligibleStudents}
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
                    {errors.validFrom && <p className="text-sm text-destructive">{errors.validFrom.message}</p>}
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
                    {errors.validUntil && <p className="text-sm text-destructive">{errors.validUntil.message}</p>}
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
