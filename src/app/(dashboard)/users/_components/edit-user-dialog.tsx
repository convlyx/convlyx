"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { updateUserSchema, type UpdateUserInput } from "@/lib/validations/user";
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

type UserData = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
  school: { id: string; name: string };
};

type EditUserDialogProps = {
  userData: UserData;
  open: boolean;
  onClose: () => void;
};

export function EditUserDialog({ userData, open, onClose }: EditUserDialogProps) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const { data: schools } = trpc.school.list.useQuery();

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      id: userData.id,
      name: userData.name,
      phone: userData.phone ?? undefined,
      role: userData.role as UpdateUserInput["role"],
      schoolId: userData.school.id,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        id: userData.id,
        name: userData.name,
        phone: userData.phone ?? undefined,
        role: userData.role as UpdateUserInput["role"],
        schoolId: userData.school.id,
      });
    }
  }, [open, userData, reset]);

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      toast.success(t("users.userUpdated"));
      utils.user.list.invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(data: UpdateUserInput) {
    updateMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.edit")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <DialogBody>
            <div className="grid gap-4">
              <input type="hidden" {...register("id")} />

              <div className="grid gap-2">
                <Label htmlFor="edit-user-name">{t("common.name")}</Label>
                <Input id="edit-user-name" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-user-phone">{t("common.phone")}</Label>
                <Input id="edit-user-phone" type="tel" {...register("phone")} />
              </div>

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
