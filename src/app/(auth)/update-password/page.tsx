"use client";

import { useTranslations } from "next-intl";
import { AuthLayout } from "../_components/auth-layout";
import { UpdatePasswordForm } from "./_components/update-password-form";

export default function UpdatePasswordPage() {
  const t = useTranslations();

  return (
    <AuthLayout>
      <div className="space-y-2 lg:text-left text-center">
        <h1 className="text-xl lg:text-2xl font-bold">{t("auth.newPassword")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.newPasswordDescription")}
        </p>
      </div>

      <UpdatePasswordForm />
    </AuthLayout>
  );
}
