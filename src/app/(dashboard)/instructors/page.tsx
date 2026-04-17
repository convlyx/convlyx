import { useTranslations } from "next-intl";

export default function InstructorsPage() {
  const t = useTranslations("nav");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("instructors")}</h1>
      <p className="text-muted-foreground">Em desenvolvimento — Fase 2</p>
    </div>
  );
}
