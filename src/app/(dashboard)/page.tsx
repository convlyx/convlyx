import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("welcome")}</h1>
      <p className="text-muted-foreground">{t("todaySchedule")}</p>
    </div>
  );
}
