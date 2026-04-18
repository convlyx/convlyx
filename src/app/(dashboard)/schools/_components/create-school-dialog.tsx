"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { createSchoolSchema, type CreateSchoolInput } from "@/lib/validations/school";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function CreateSchoolDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSchoolInput>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: { name: "", address: "", phone: "" },
  });

  const createMutation = trpc.school.create.useMutation({
    onSuccess: () => {
      toast.success("Escola criada com sucesso");
      utils.school.list.invalidate();
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(data: CreateSchoolInput) {
    createMutation.mutate(data);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("schools.create")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("schools.create")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
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
