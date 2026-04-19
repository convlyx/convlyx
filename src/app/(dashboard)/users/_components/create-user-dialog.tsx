"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { createUserSchema, type CreateUserInput } from "@/lib/validations/user";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { toast } from "sonner";

const ROLES = ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"] as const;

export function CreateUserDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: schools } = trpc.school.list.useQuery();

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors } } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", role: "STUDENT", schoolId: "" },
  });

  // Auto-select when only one school
  const schoolId = watch("schoolId");
  useEffect(() => {
    if (!schoolId && schools?.length === 1) setValue("schoolId", schools[0].id);
  }, [schools, schoolId, setValue]);

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      toast.success(t("toast.inviteSent"));
      utils.user.list.invalidate();
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(data: CreateUserInput) {
    createMutation.mutate(data);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("users.create")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.create")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <DialogBody>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="user-name">{t("common.name")}</Label>
                  <Input id="user-name" {...register("name")} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="user-email">{t("auth.email")}</Label>
                  <Input id="user-email" type="email" {...register("email")} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  {t("users.inviteInfo")}
                </p>
                <div className="grid gap-2">
                  <Label>{t("common.role")}</Label>
                  <Controller
                    control={control}
                    name="role"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {t(`roles.${role}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
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
                  {errors.schoolId && <p className="text-sm text-destructive">{errors.schoolId.message}</p>}
                </div>
              </div>
            </DialogBody>
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
