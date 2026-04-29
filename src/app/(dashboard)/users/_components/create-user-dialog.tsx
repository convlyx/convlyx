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
import { CategorySelect } from "@/components/category-select";
import { CategoryMultiSelect } from "@/components/category-multi-select";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import type { UserRole } from "@/generated/prisma/enums";

const ROLES = ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"] as const;

type CreateUserDialogProps = {
  /** Pre-select and lock the role (hides the role selector) */
  fixedRole?: UserRole;
  /** Custom button label */
  buttonLabel?: string;
};

export function CreateUserDialog({ fixedRole, buttonLabel }: CreateUserDialogProps = {}) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: schools, isLoading: schoolsLoading } = trpc.school.list.useQuery();

  const defaultRole = fixedRole ?? "STUDENT";

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors } } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: defaultRole,
      schoolId: "",
      initialCategory: undefined,
      qualifiedCategories: [],
    },
  });

  // Auto-select when only one school
  const schoolId = watch("schoolId");
  useEffect(() => {
    if (!schoolId && schools?.length === 1) setValue("schoolId", schools[0].id);
  }, [schools, schoolId, setValue]);

  // Keep role in sync if fixedRole is set
  useEffect(() => {
    if (fixedRole) setValue("role", fixedRole);
  }, [fixedRole, setValue]);

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      toast.success(t("toast.inviteSent"));
      utils.user.list.invalidate();
      setOpen(false);
      reset({
        name: "",
        email: "",
        role: defaultRole,
        schoolId: schools?.length === 1 ? schools[0].id : "",
        initialCategory: undefined,
        qualifiedCategories: [],
      });
    },
    onError,
  });

  const role = watch("role");

  function onSubmit(data: CreateUserInput) {
    createMutation.mutate(data);
  }

  const label = buttonLabel ?? t("users.create");

  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
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
                  <Label htmlFor="user-phone">{t("common.phone")}</Label>
                  <Input id="user-phone" type="tel" {...register("phone")} />
                </div>
                {/* Only show role selector when no fixedRole */}
                {!fixedRole && (
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
                )}
                {/* Hidden school field — auto-set */}
                <input type="hidden" {...register("schoolId")} />

                {role === "STUDENT" && (
                  <div className="grid gap-2">
                    <Label>{t("students.initialCategory")}</Label>
                    <Controller
                      control={control}
                      name="initialCategory"
                      render={({ field }) => (
                        <CategorySelect
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={t("courses.selectCategory")}
                        />
                      )}
                    />
                    {errors.initialCategory && (
                      <p className="text-sm text-destructive">
                        {t("students.categoryRequired")}
                      </p>
                    )}
                  </div>
                )}

                {role === "INSTRUCTOR" && (
                  <div className="grid gap-2">
                    <Label>{t("instructors.qualifiedCategories")}</Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      {t("instructors.qualifiedCategoriesHint")}
                    </p>
                    <Controller
                      control={control}
                      name="qualifiedCategories"
                      render={({ field }) => (
                        <CategoryMultiSelect
                          value={field.value ?? []}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || schoolsLoading}>
                {createMutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
