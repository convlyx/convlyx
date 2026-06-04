"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import {
  createSchoolSchema,
  type CreateSchoolInput,
  SCHOOL_TIME_ZONES,
  type SchoolTimeZone,
} from "@/lib/validations/school";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogBody,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/radix-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";

const TIME_ZONE_LABEL_KEYS: Record<SchoolTimeZone, string> = {
  "Europe/Lisbon": "schools.timeZoneContinente",
  "Atlantic/Madeira": "schools.timeZoneMadeira",
  "Atlantic/Azores": "schools.timeZoneAcores",
};

export function CreateSchoolDialog() {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateSchoolInput>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: { name: "", address: "", phone: "", timeZone: "Europe/Lisbon" },
  });

  const createMutation = trpc.school.create.useMutation({
    onSuccess: () => {
      toast.success(t("toast.schoolCreated"));
      utils.school.list.invalidate();
      setOpen(false);
      reset();
    },
    onError,
  });

  function onSubmit(data: CreateSchoolInput) {
    createMutation.mutate(data);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("schools.create")}</Button>
      <Dialog
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("schools.create")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <DialogBody>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="school-name">{t("common.name")}</Label>
                <Input id="school-name" {...register("name")} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="school-address">{t("common.address")}</Label>
                <Input id="school-address" {...register("address")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="school-phone">{t("common.phone")}</Label>
                <Input id="school-phone" {...register("phone")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="school-time-zone">{t("schools.timeZoneLabel")}</Label>
                <Select
                  value={watch("timeZone")}
                  onValueChange={(v) => setValue("timeZone", v as SchoolTimeZone, { shouldDirty: true })}
                >
                  <SelectTrigger id="school-time-zone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHOOL_TIME_ZONES.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {t(TIME_ZONE_LABEL_KEYS[zone])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">{t("schools.timeZoneHelp")}</p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
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
