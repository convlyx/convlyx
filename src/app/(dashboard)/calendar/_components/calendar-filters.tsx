"use client";

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

  return (
    <div className="flex items-center gap-3">
      <Select value={typeFilter} onValueChange={onTypeChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{t("classes.allTypes")}</SelectItem>
          <SelectItem value="THEORY">{t("classes.theory")}</SelectItem>
          <SelectItem value="PRACTICAL">{t("classes.practical")}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={schoolFilter} onValueChange={onSchoolChange}>
        <SelectTrigger className="w-[200px]">
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
