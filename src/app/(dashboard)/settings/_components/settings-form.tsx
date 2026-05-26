"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { trpc } from "@/lib/trpc";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/radix-select";

const CANCELLATION_NOTICE_OPTIONS = [0, 2, 6, 12, 24, 48, 72] as const;
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { PushManager } from "@/components/push-manager";
import { InstallQR } from "./install-qr";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { Building2, Lock, Bell, Users2 } from "lucide-react";
import { GdprPanel } from "./gdpr-panel";

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
    subdomain: string;
    address: string;
    phone: string;
    cancellationNoticeHours: number;
    practicalSelfEnrollEnabled: boolean;
    userCount: number;
    classCount: number;
  };
  tenant: {
    id: string;
    name: string;
  };
};

const schoolFormSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  address: z.string(),
  phone: z.string(),
  cancellationNoticeHours: z.coerce.number().int().min(0).max(168),
  practicalSelfEnrollEnabled: z.boolean(),
});

const tenantFormSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
});

export function SettingsForm({ user, school, tenant }: SettingsFormProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { onError } = useTranslatedError();

  const isAdmin = user.role === "ADMIN";
  const isSecretary = user.role === "SECRETARY";
  const canEditSchool = isAdmin || isSecretary;

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
    resolver: zodResolver(schoolFormSchema),
    defaultValues: {
      name: school.name,
      address: school.address,
      phone: school.phone,
      cancellationNoticeHours: school.cancellationNoticeHours,
      practicalSelfEnrollEnabled: school.practicalSelfEnrollEnabled,
    },
  });
  const updateSchoolMutation = trpc.school.update.useMutation({
    onSuccess: () => toast.success(t("schoolUpdated")),
    onError,
  });

  // --- Tenant section ---
  const tenantForm = useForm({ resolver: zodResolver(tenantFormSchema), defaultValues: { name: tenant.name } });
  const updateTenantMutation = trpc.school.updateTenant.useMutation({
    onSuccess: () => toast.success(t("tenantUpdated")),
    onError,
  });

  // Students/instructors only have one section ("Conta"); skip the tab strip
  // entirely for them. Admins see all three tabs, secretaries see two.
  const useTabs = canEditSchool;
  const defaultTab = canEditSchool ? "school" : "account";

  const schoolPanel = (
    <>
      <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("schoolInfo")}</h2>
        </div>
        <form
          onSubmit={schoolForm.handleSubmit((data) =>
            updateSchoolMutation.mutate({
              id: school.id,
              name: data.name,
              address: data.address || undefined,
              phone: data.phone || undefined,
              cancellationNoticeHours: data.cancellationNoticeHours,
              practicalSelfEnrollEnabled: data.practicalSelfEnrollEnabled,
            })
          )}
          className="space-y-3"
        >
          <div className="grid gap-2">
            <Label htmlFor="school-name">{tc("name")}</Label>
            <Input id="school-name" {...schoolForm.register("name")} />
            {schoolForm.formState.errors.name && <p className="text-sm text-destructive">{schoolForm.formState.errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="school-address">{tc("address")}</Label>
            <Input id="school-address" {...schoolForm.register("address")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="school-phone">{tc("phone")}</Label>
            <Input id="school-phone" {...schoolForm.register("phone")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="school-cancellation-notice">{t("cancellationNoticeLabel")}</Label>
            <Select
              value={String(schoolForm.watch("cancellationNoticeHours") ?? 24)}
              onValueChange={(v) =>
                schoolForm.setValue("cancellationNoticeHours", Number(v), {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="school-cancellation-notice" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_NOTICE_OPTIONS.map((hours) => (
                  <SelectItem key={hours} value={String(hours)}>
                    {hours === 0
                      ? t("cancellationNoticeOptionAlways")
                      : t("cancellationNoticeOptionHours", { hours })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {schoolForm.formState.errors.cancellationNoticeHours && (
              <p className="text-sm text-destructive">
                {schoolForm.formState.errors.cancellationNoticeHours.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="school-practical-self-enroll">{t("practicalSelfEnrollLabel")}</Label>
            <Select
              value={schoolForm.watch("practicalSelfEnrollEnabled") ? "yes" : "no"}
              onValueChange={(v) =>
                schoolForm.setValue("practicalSelfEnrollEnabled", v === "yes", {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="school-practical-self-enroll" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">{t("practicalSelfEnrollOptionStaffOnly")}</SelectItem>
                <SelectItem value="yes">{t("practicalSelfEnrollOptionAllowed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={updateSchoolMutation.isPending}>
            {updateSchoolMutation.isPending ? tc("loading") : tc("save")}
          </Button>
        </form>
      </section>

      <InstallQR subdomain={school.subdomain} schoolName={school.name} />
    </>
  );

  const accountPanel = (
    <>
      <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("changePassword")}</h2>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="current-password">{t("currentPassword")}</Label>
            <Input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={passwordLoading}>
            {passwordLoading ? tc("loading") : t("changePassword")}
          </Button>
        </form>
      </section>

      {!canEditSchool && (
        <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t("pushNotifications")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{t("pushDescription")}</p>
          <PushManager userId={user.id} />
        </section>
      )}
    </>
  );

  const groupPanel = isAdmin && (
    <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
      <div className="flex items-center gap-2">
        <Users2 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t("tenantInfo")}</h2>
      </div>
      <form
        onSubmit={tenantForm.handleSubmit((data) =>
          updateTenantMutation.mutate({ name: data.name })
        )}
        className="space-y-3"
      >
        <div className="grid gap-2">
          <Label htmlFor="tenant-name">{t("groupName")}</Label>
          <Input id="tenant-name" {...tenantForm.register("name")} />
          {tenantForm.formState.errors.name && <p className="text-sm text-destructive">{tenantForm.formState.errors.name.message}</p>}
        </div>
        <Button type="submit" disabled={updateTenantMutation.isPending}>
          {updateTenantMutation.isPending ? tc("loading") : tc("save")}
        </Button>
      </form>
    </section>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {useTabs ? (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {canEditSchool && <TabsTab value="school">{t("tabSchool")}</TabsTab>}
            <TabsTab value="account">{t("tabAccount")}</TabsTab>
            {isAdmin && <TabsTab value="group">{t("tabGroup")}</TabsTab>}
            {isAdmin && <TabsTab value="gdpr">{t("tabGdpr")}</TabsTab>}
          </TabsList>

          {canEditSchool && (
            <TabsPanel value="school">{schoolPanel}</TabsPanel>
          )}
          <TabsPanel value="account">{accountPanel}</TabsPanel>
          {isAdmin && <TabsPanel value="group">{groupPanel}</TabsPanel>}
          {isAdmin && (
            <TabsPanel value="gdpr">
              <GdprPanel />
            </TabsPanel>
          )}
        </Tabs>
      ) : (
        <div className="space-y-6">{accountPanel}</div>
      )}
    </div>
  );
}
