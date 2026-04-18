"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { updateClassSchema, type UpdateClassInput } from "@/lib/validations/class";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { toast } from "sonner";

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

type EditClassDialogProps = {
  classData: ClassData;
  open: boolean;
  onClose: () => void;
};

function toDateInputValue(d: string | Date): string {
  const date = new Date(d);
  return date.toISOString().split("T")[0];
}

function toTimeInputValue(d: string | Date): string {
  const date = new Date(d);
  return date.toTimeString().slice(0, 5);
}

export function EditClassDialog({ classData, open, onClose }: EditClassDialogProps) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const { data: instructors } = trpc.user.list.useQuery({ role: "INSTRUCTOR" });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<UpdateClassInput>({
    resolver: zodResolver(updateClassSchema),
    defaultValues: {
      id: classData.id,
      instructorId: classData.instructor.id,
      title: classData.title,
      capacity: classData.capacity,
      startsAt: new Date(classData.startsAt).toISOString(),
      endsAt: new Date(classData.endsAt).toISOString(),
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        id: classData.id,
        instructorId: classData.instructor.id,
        title: classData.title,
        capacity: classData.capacity,
        startsAt: new Date(classData.startsAt).toISOString(),
        endsAt: new Date(classData.endsAt).toISOString(),
      });
    }
  }, [open, classData, reset]);

  const updateMutation = trpc.class.update.useMutation({
    onSuccess: () => {
      toast.success(t("classes.classUpdated"));
      utils.class.list.invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(data: {
    id: string;
    instructorId: string;
    title: string;
    capacity: number;
    startsAt: string;
    endsAt: string;
  }) {
    // Reconstruct ISO datetimes from the form date/time inputs
    updateMutation.mutate(data);
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    // We need to manually construct the datetimes from the date + time inputs
    const formEl = e.target as HTMLFormElement;
    const dateVal = (formEl.querySelector("#edit-class-date") as HTMLInputElement).value;
    const startVal = (formEl.querySelector("#edit-class-start") as HTMLInputElement).value;
    const endVal = (formEl.querySelector("#edit-class-end") as HTMLInputElement).value;

    handleSubmit((data) => {
      onSubmit({
        ...data,
        startsAt: new Date(`${dateVal}T${startVal}:00`).toISOString(),
        endsAt: new Date(`${dateVal}T${endVal}:00`).toISOString(),
      });
    })(e);
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("classes.edit")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleFormSubmit} className="grid gap-4">
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-class-title">{t("common.name")}</Label>
            <Input id="edit-class-title" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-class-capacity">{t("classes.capacity")}</Label>
            <Input id="edit-class-capacity" type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-class-date">{t("classes.date")}</Label>
            <Input id="edit-class-date" type="date" defaultValue={toDateInputValue(classData.startsAt)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-class-start">{t("classes.startTime")}</Label>
              <Input id="edit-class-start" type="time" defaultValue={toTimeInputValue(classData.startsAt)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-class-end">{t("classes.endTime")}</Label>
              <Input id="edit-class-end" type="time" defaultValue={toTimeInputValue(classData.endsAt)} />
            </div>
          </div>

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
