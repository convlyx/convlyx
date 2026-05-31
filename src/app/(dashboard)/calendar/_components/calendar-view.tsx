"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { ClassCalendar } from "./class-calendar";
import { CalendarFilters } from "./calendar-filters";
import { CreateClassDialog } from "@/app/(dashboard)/classes/_components/create-class-dialog";
import type { UserRole } from "@/generated/prisma/enums";

export function CalendarView({ userRole, userId }: { userRole: UserRole; userId: string }) {
  const t = useTranslations("nav");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [instructorFilter, setInstructorFilter] = useState("ALL");

  const showFilters = userRole === "ADMIN" || userRole === "SECRETARY";
  // STUDENT/INSTRUCTOR get the mobile shell whose curved header already shows
  // the screen title, so only render the in-content title for staff (desktop).
  const showTitle = userRole === "ADMIN" || userRole === "SECRETARY";
  const canCreate = userRole === "ADMIN" || userRole === "SECRETARY" || userRole === "INSTRUCTOR";
  const { data: instructorsData } = trpc.user.list.useQuery(
    { role: "INSTRUCTOR", status: "ACTIVE" },
    { enabled: showFilters },
  );
  const instructors = instructorsData?.items;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {showTitle && <h1 className="text-2xl font-bold">{t("calendar")}</h1>}
        <div className="flex flex-wrap items-center gap-2">
          {showFilters && (
            <CalendarFilters
              typeFilter={typeFilter}
              onTypeChange={setTypeFilter}
              instructorFilter={instructorFilter}
              onInstructorChange={setInstructorFilter}
              instructors={instructors ?? []}
            />
          )}
          {canCreate && (
            <CreateClassDialog
              userRole={userRole}
              userId={userId}
              prefill={
                instructorFilter !== "ALL" || typeFilter !== "ALL"
                  ? {
                      ...(instructorFilter !== "ALL" && { instructorId: instructorFilter }),
                      ...(typeFilter !== "ALL" && { classType: typeFilter as "THEORY" | "PRACTICAL" }),
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
      <ClassCalendar
        filter={{
          ...(typeFilter !== "ALL" && { classType: typeFilter as "THEORY" | "PRACTICAL" }),
          ...(instructorFilter !== "ALL" && { instructorId: instructorFilter }),
        }}
        userRole={userRole}
        userId={userId}
      />
    </div>
  );
}
