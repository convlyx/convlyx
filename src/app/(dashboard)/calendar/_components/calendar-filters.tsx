"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";

type CalendarFiltersProps = {
  typeFilter: string;
  schoolFilter: string;
  onTypeChange: (val: string) => void;
  onSchoolChange: (val: string) => void;
};

export function CalendarFilters({
  typeFilter,
  schoolFilter,
  onTypeChange,
  onSchoolChange,
}: CalendarFiltersProps) {
  const t = useTranslations();
  const { data: schools } = trpc.school.list.useQuery();

  // Auto-select when only one school
  useEffect(() => {
    if (schoolFilter === "ALL" && schools?.length === 1) {
      onSchoolChange(schools[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schools]);

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
      <Select value={schoolFilter} onValueChange={onSchoolChange}>
        <SelectTrigger className="w-auto min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{t("schools.allSchools")}</SelectItem>
          {schools?.map((school) => (
            <SelectItem key={school.id} value={school.id}>
              {school.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
