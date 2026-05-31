"use client";

import { useTranslations } from "next-intl";
import { AuthLayout } from "../_components/auth-layout";
import { ResetPasswordForm } from "./_components/reset-password-form";

export default function ResetPasswordPage() {
  const t = useTranslations();

  return (
    <AuthLayout>
      <div className="space-y-2 lg:text-left text-center">
        <h1 className="text-xl lg:text-2xl font-bold">{t("auth.resetPassword")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.resetPasswordDescription")}
        </p>
      </div>

      <ResetPasswordForm />
    </AuthLayout>
  );
}
