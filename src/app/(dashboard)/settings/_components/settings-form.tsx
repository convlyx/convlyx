"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type SettingsFormProps = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  school: {
    id: string;
    name: string;
    address: string;
    phone: string;
  };
  tenant: {
    id: string;
    name: string;
  };
};

export function SettingsForm({ user, school, tenant }: SettingsFormProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  const isAdmin = user.role === "ADMIN";
  const isSecretary = user.role === "SECRETARY";
  const canEditSchool = isAdmin || isSecretary;

  // --- Profile section ---
  const profileForm = useForm({ defaultValues: { name: user.name } });
  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => toast.success(t("profileUpdated")),
    onError: (error) => toast.error(error.message),
  });

  // --- Password section ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }
    setPasswordLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(t("passwordError"));
      } else {
        toast.success(t("passwordUpdated"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast.error(t("passwordError"));
    } finally {
      setPasswordLoading(false);
    }
  }

  // --- School section ---
  const schoolForm = useForm({
    defaultValues: { name: school.name, address: school.address, phone: school.phone },
  });
  const updateSchoolMutation = trpc.school.update.useMutation({
    onSuccess: () => toast.success(t("schoolUpdated")),
    onError: (error) => toast.error(error.message),
  });

  // --- Tenant section ---
  const tenantForm = useForm({ defaultValues: { name: tenant.name } });
  const updateTenantMutation = trpc.school.updateTenant.useMutation({
    onSuccess: () => toast.success(t("tenantUpdated")),
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Section A: Profile */}
      <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
        <h2 className="text-lg font-semibold">{t("profile")}</h2>

        <form
          onSubmit={profileForm.handleSubmit((data) =>
            updateProfileMutation.mutate({ name: data.name })
          )}
          className="space-y-3"
        >
          <div className="grid gap-2">
            <Label htmlFor="profile-name">{tc("name")}</Label>
            <Input id="profile-name" {...profileForm.register("name")} />
          </div>
          <Button type="submit" disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending ? tc("loading") : t("updateName")}
          </Button>
        </form>

        <hr />

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <h3 className="text-sm font-medium">{t("changePassword")}</h3>
          <div className="grid gap-2">
            <Label htmlFor="current-password">{t("currentPassword")}</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={passwordLoading}>
            {passwordLoading ? tc("loading") : t("changePassword")}
          </Button>
        </form>
      </section>

      {/* Section B: School (ADMIN + SECRETARY) */}
      {canEditSchool && (
        <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
          <h2 className="text-lg font-semibold">{t("schoolInfo")}</h2>
          <form
            onSubmit={schoolForm.handleSubmit((data) =>
              updateSchoolMutation.mutate({
                id: school.id,
                name: data.name,
                address: data.address || undefined,
                phone: data.phone || undefined,
              })
            )}
            className="space-y-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="school-name">{tc("name")}</Label>
              <Input id="school-name" {...schoolForm.register("name")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school-address">{tc("address")}</Label>
              <Input id="school-address" {...schoolForm.register("address")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school-phone">{tc("phone")}</Label>
              <Input id="school-phone" {...schoolForm.register("phone")} />
            </div>
            <Button type="submit" disabled={updateSchoolMutation.isPending}>
              {updateSchoolMutation.isPending ? tc("loading") : tc("save")}
            </Button>
          </form>
        </section>
      )}

      {/* Section C: Tenant (ADMIN only) */}
      {isAdmin && (
        <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
          <h2 className="text-lg font-semibold">{t("tenantInfo")}</h2>
          <form
            onSubmit={tenantForm.handleSubmit((data) =>
              updateTenantMutation.mutate({ name: data.name })
            )}
            className="space-y-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="tenant-name">{t("groupName")}</Label>
              <Input id="tenant-name" {...tenantForm.register("name")} />
            </div>
            <Button type="submit" disabled={updateTenantMutation.isPending}>
              {updateTenantMutation.isPending ? tc("loading") : tc("save")}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
