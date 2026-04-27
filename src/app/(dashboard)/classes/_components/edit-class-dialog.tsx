"use client";

import { useEffect } from "react";
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
import { DatePicker, TimePicker } from "@/components/date-picker";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";

type ClassData = {
  id: string;
  title: string;
  classType: string;
  startsAt: string | Date;
  endsAt: string | Date;
  capacity: number;
  status: string;
  instructor: { id: string; name: string };
  school: { id: string; name: string };
};

const editClassFormSchema = z.object({
  id: z.string().uuid(),
  instructorId: z.string().min(1, "Selecione um instrutor"),
  title: z.string().min(1, "O título é obrigatório"),
  capacity: z.number().int().min(1, "A capacidade deve ser pelo menos 1"),
  date: z.string().min(1, "Selecione uma data"),
  startTime: z.string().min(1, "Selecione hora de início"),
  endTime: z.string().min(1, "Selecione hora de fim"),
});

type EditClassFormData = z.infer<typeof editClassFormSchema>;

function toDateValue(d: string | Date): string {
  const date = new Date(d);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeValue(d: string | Date): string {
  const date = new Date(d);
  return date.toTimeString().slice(0, 5);
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

  const { data: instructors } = trpc.user.list.useQuery({ role: "INSTRUCTOR", status: "ACTIVE" });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<EditClassFormData>({
    resolver: zodResolver(editClassFormSchema),
    defaultValues: {
      id: classData.id,
      instructorId: classData.instructor.id,
      title: classData.title,
      capacity: classData.capacity,
      date: toDateValue(classData.startsAt),
      startTime: toTimeValue(classData.startsAt),
      endTime: toTimeValue(classData.endsAt),
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        id: classData.id,
        instructorId: classData.instructor.id,
        title: classData.title,
        capacity: classData.capacity,
        date: toDateValue(classData.startsAt),
        startTime: toTimeValue(classData.startsAt),
        endTime: toTimeValue(classData.endsAt),
      });
    }
  }, [open, classData, reset]);

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
      title: data.title,
      capacity: data.capacity,
      startsAt: new Date(`${data.date}T${data.startTime}:00`).toISOString(),
      endsAt: new Date(`${data.date}T${data.endTime}:00`).toISOString(),
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
                <Label htmlFor="edit-class-title">{t("common.name")}</Label>
                <Input id="edit-class-title" {...register("title")} />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-class-capacity">{t("classes.capacity")}</Label>
                <Input id="edit-class-capacity" type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
                {errors.capacity && <p className="text-sm text-destructive">{errors.capacity.message}</p>}
              </div>

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
