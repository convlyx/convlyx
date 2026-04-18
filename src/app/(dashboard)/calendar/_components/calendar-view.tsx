"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClassCalendar } from "./class-calendar";
import { CalendarFilters } from "./calendar-filters";
import type { UserRole } from "@/generated/prisma/enums";

export function CalendarView({ userRole }: { userRole: UserRole }) {
  const t = useTranslations("nav");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [schoolFilter, setSchoolFilter] = useState("ALL");

  const showFilters = userRole === "ADMIN" || userRole === "SECRETARY";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("calendar")}</h1>
        {showFilters && (
          <CalendarFilters
            typeFilter={typeFilter}
            schoolFilter={schoolFilter}
            onTypeChange={setTypeFilter}
            onSchoolChange={setSchoolFilter}
          />
        )}
      </div>
      <ClassCalendar
        filter={{
          ...(typeFilter !== "ALL" && { classType: typeFilter as "THEORY" | "PRACTICAL" }),
          ...(schoolFilter !== "ALL" && { schoolId: schoolFilter }),
        }}
        userRole={userRole}
      />
    </div>
  );
}
