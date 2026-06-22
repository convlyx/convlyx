"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LICENSE_CATEGORIES, type LicenseCategory } from "@/lib/license-categories";
import {
  ClassCategoryField,
  ClassInstructorField,
  ClassTitleField,
  ClassDateField,
  ClassTimeRangeRow,
  useQualifiedInstructors,
} from "./class-form-fields";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { wallClockToISO } from "@/lib/dates";

type ClassData = {
  id: string;
  title: string;
  classType: string;
  category?: LicenseCategory | null;
  startsAt: string | Date;
  endsAt: string | Date;
  capacity: number;
  status: string;
  instructor: { id: string; name: string };
  school: { id: string; name: string; timeZone: string };
};

const editClassFormSchema = z.object({
  id: z.string().uuid(),
  instructorId: z.string().min(1, "Selecione um instrutor"),
  // Optional in the schema; the server enforces required for practical classes.
  category: z.enum(LICENSE_CATEGORIES).optional(),
  title: z.string().min(1, "O título é obrigatório"),
  capacity: z.number().int().min(1, "A capacidade deve ser pelo menos 1"),
  date: z.string().min(1, "Selecione uma data"),
  startTime: z.string().min(1, "Selecione hora de início"),
  endTime: z.string().min(1, "Selecione hora de fim"),
});

type EditClassFormData = z.infer<typeof editClassFormSchema>;

// Split a stored UTC instant into the school-zone wall-clock date/time strings
// used to pre-fill the form fields.
function zonedParts(d: string | Date, timeZone: string) {
  const date = new Date(d);
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`,
  };
}

function toDateValue(d: string | Date, timeZone: string): string {
  return zonedParts(d, timeZone).date;
}

function toTimeValue(d: string | Date, timeZone: string): string {
  return zonedParts(d, timeZone).time;
}

export function EditClassDialog({
  classData,
  open,
  onClose,
}: {
  classData: ClassData;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();

  const { data: instructorsData } = trpc.user.list.useQuery({ role: "INSTRUCTOR", status: "ACTIVE" });
  const instructors = instructorsData?.items;

  // Class times are stored in UTC; interpret/display them in the school's zone.
  const tz = classData.school.timeZone;

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<EditClassFormData>({
    resolver: zodResolver(editClassFormSchema),
    defaultValues: {
      id: classData.id,
      instructorId: classData.instructor.id,
      category: classData.category ?? undefined,
      title: classData.title,
      capacity: classData.capacity,
      date: toDateValue(classData.startsAt, tz),
      startTime: toTimeValue(classData.startsAt, tz),
      endTime: toTimeValue(classData.endsAt, tz),
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        id: classData.id,
        instructorId: classData.instructor.id,
        category: classData.category ?? undefined,
        title: classData.title,
        capacity: classData.capacity,
        date: toDateValue(classData.startsAt, tz),
        startTime: toTimeValue(classData.startsAt, tz),
        endTime: toTimeValue(classData.endsAt, tz),
      });
    }
  }, [open, classData, reset, tz]);

  const category = watch("category");
  const instructorId = watch("instructorId");
  const filteredInstructors = useQualifiedInstructors({
    instructors,
    category,
    instructorId,
    onClear: () => setValue("instructorId", ""),
  });

  const updateMutation = trpc.class.update.useMutation({
    onSuccess: () => {
      toast.success(t("classes.classUpdated"));
      utils.class.list.invalidate();
      onClose();
    },
    onError,
  });

  function onSubmit(data: EditClassFormData) {
    updateMutation.mutate({
      id: data.id,
      instructorId: data.instructorId,
      category: data.category,
      title: data.title,
      capacity: data.capacity,
      startsAt: wallClockToISO(data.date, data.startTime, tz),
      endsAt: wallClockToISO(data.date, data.endTime, tz),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("classes.edit")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <DialogBody>
            <div className="grid gap-4">
              <input type="hidden" {...register("id")} />

              {classData.classType === "PRACTICAL" && (
                <ClassCategoryField control={control} name="category" error={errors.category?.message} />
              )}

              <ClassInstructorField
                control={control}
                name="instructorId"
                instructors={filteredInstructors}
                error={errors.instructorId?.message}
              />

              <ClassTitleField register={register} name="title" id="edit-class-title" error={errors.title?.message} />

              <div className="grid gap-2">
                <Label htmlFor="edit-class-capacity">{t("classes.capacity")}</Label>
                <Input id="edit-class-capacity" type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
                {errors.capacity && <p className="text-sm text-destructive">{errors.capacity.message}</p>}
              </div>

              <ClassDateField control={control} name="date" error={errors.date?.message} />
              <ClassTimeRangeRow control={control} startName="startTime" endName="endTime" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
