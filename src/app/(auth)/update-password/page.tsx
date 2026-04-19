"use client";

import { useTranslations } from "next-intl";
import { UpdatePasswordForm } from "./_components/update-password-form";

export default function UpdatePasswordPage() {
  const t = useTranslations("auth");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/3 via-transparent to-transparent" />

      <div className="relative w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 card-shadow">
        <div className="text-center space-y-1">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-md">
            EC
          </div>
          <h1 className="text-xl font-bold">{t("newPassword")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("newPasswordDescription")}
          </p>
        </div>
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
