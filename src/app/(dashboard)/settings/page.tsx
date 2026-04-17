import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("nav");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings")}</h1>
      <p className="text-muted-foreground">Em desenvolvimento</p>
    </div>
  );
}
