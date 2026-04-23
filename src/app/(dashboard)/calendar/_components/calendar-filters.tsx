"use client";

import { useTranslations } from "next-intl";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";

type CalendarFiltersProps = {
  typeFilter: string;
  onTypeChange: (val: string) => void;
};

export function CalendarFilters({
  typeFilter,
  onTypeChange,
}: CalendarFiltersProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={typeFilter} onValueChange={onTypeChange}>
        <SelectTrigger className="w-auto min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{t("classes.allTypes")}</SelectItem>
          <SelectItem value="THEORY">{t("classes.theory")}</SelectItem>
          <SelectItem value="PRACTICAL">{t("classes.practical")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
