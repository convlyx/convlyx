"use client";

import { useTranslations } from "next-intl";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";

type CalendarFiltersProps = {
  typeFilter: string;
  onTypeChange: (val: string) => void;
  instructorFilter: string;
  onInstructorChange: (val: string) => void;
  instructors: { id: string; name: string }[];
};

export function CalendarFilters({
  typeFilter,
  onTypeChange,
  instructorFilter,
  onInstructorChange,
  instructors,
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
      <Select value={instructorFilter} onValueChange={onInstructorChange}>
        <SelectTrigger className="w-auto min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{t("classes.allInstructors")}</SelectItem>
          {instructors.map((i) => (
            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
