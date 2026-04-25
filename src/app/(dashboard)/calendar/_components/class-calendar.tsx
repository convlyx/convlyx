"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import { trpc } from "@/lib/trpc";
import { ClassDetailDialog } from "./class-detail-dialog";

type CalendarFilter = {
  schoolId?: string;
  classType?: "THEORY" | "PRACTICAL";
};

// Enrolled classes — vivid solid colors
const enrolledColors: Record<string, { bg: string; border: string }> = {
  THEORY: { bg: "#3b82f6", border: "#2563eb" },
  PRACTICAL: { bg: "#10b981", border: "#059669" },
};

// Available classes — lighter, more muted
const availableColors: Record<string, { bg: string; border: string }> = {
  THEORY: { bg: "#93c5fd", border: "#60a5fa" },
  PRACTICAL: { bg: "#6ee7b7", border: "#34d399" },
};

const statusColors: Record<string, { bg: string; border: string }> = {
  CANCELLED: { bg: "#ef4444", border: "#dc2626" },
  COMPLETED: { bg: "#9ca3af", border: "#6b7280" },
};

export function ClassCalendar({
  filter,
  userRole,
}: {
  filter?: CalendarFilter;
  userRole: string;
}) {
  const t = useTranslations();
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const queryInput = useMemo(() => ({
    ...(filter?.schoolId && { schoolId: filter.schoolId }),
    ...(filter?.classType && { classType: filter.classType }),
    ...(dateRange?.from && { from: dateRange.from }),
    ...(dateRange?.to && { to: dateRange.to }),
  }), [filter, dateRange]);

  const { data: classes, isFetching } = trpc.class.list.useQuery(queryInput);

  // For students: fetch enrollments to highlight enrolled classes
  const isStudent = userRole === "STUDENT";
  const { data: enrollments } = trpc.enrollment.listByStudent.useQuery(
    undefined,
    { enabled: isStudent }
  );

  const enrolledSessionIds = useMemo(() => {
    if (!isStudent || !enrollments) return new Set<string>();
    return new Set(
      enrollments
        .filter((e) => e.status === "ENROLLED")
        .map((e) => e.session.id)
    );
  }, [isStudent, enrollments]);

  const events = useMemo(() => {
    if (!classes) return [];
    return classes.map((cls) => {
      const isEnrolled = enrolledSessionIds.has(cls.id);
      const isFull = cls._count.enrollments >= cls.capacity;

      let colors;
      if (statusColors[cls.status]) {
        colors = statusColors[cls.status];
      } else if (isStudent) {
        colors = isEnrolled
          ? enrolledColors[cls.classType] ?? enrolledColors.THEORY
          : availableColors[cls.classType] ?? availableColors.THEORY;
      } else {
        colors = enrolledColors[cls.classType] ?? enrolledColors.THEORY;
      }

      return {
        id: cls.id,
        title: `${cls.title} (${cls._count.enrollments}/${cls.capacity})`,
        start: cls.startsAt as unknown as string,
        end: cls.endsAt as unknown as string,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        extendedProps: {
          classType: cls.classType,
          instructor: cls.instructor.name,
          school: cls.school.name,
          status: cls.status,
          isFull,
          isEnrolled,
        },
      };
    });
  }, [classes, enrolledSessionIds, isStudent]);

  function handleEventClick(info: EventClickArg) {
    setSelectedClassId(info.event.id);
  }

  function handleDatesSet(dateInfo: { start: Date; end: Date }) {
    setDateRange({
      from: dateInfo.start.toISOString(),
      to: dateInfo.end.toISOString(),
    });
  }


  return (
    <div className="space-y-4">
      <div className="fc-wrapper">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridWeek,timeGridDay,dayGridMonth,listMonth",
            }}
            buttonText={{
              today: t("calendar.today"),
              month: t("calendar.month"),
              week: t("calendar.week"),
              day: t("calendar.day"),
              list: t("calendar.list"),
            }}
            noEventsText={isFetching ? t("common.loading") : t("classes.noClassesCalendar")}
            locale="pt"
            firstDay={1}
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            nowIndicator
            selectable={false}
            events={events}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="auto"
            eventContent={(arg) => {
              const props = arg.event.extendedProps;
              return (
                <div className="p-1 text-xs leading-tight overflow-hidden">
                  <div className="flex items-center gap-1">
                    {props.isEnrolled && (
                      <span className="flex h-1.5 w-1.5 rounded-full bg-white shrink-0" />
                    )}
                    <span className="font-medium truncate">{arg.event.title}</span>
                  </div>
                  <div className="opacity-80 truncate">{props.instructor}</div>
                </div>
              );
            }}
          />
        </div>

      {/* Legend for students */}
      {isStudent && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-blue-500" />
            {t("calendar.enrolled.theory")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-500" />
            {t("calendar.enrolled.practical")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-blue-300" />
            {t("calendar.availableLabel")}
          </span>
        </div>
      )}

      <ClassDetailDialog
        classId={selectedClassId}
        open={selectedClassId !== null}
        onClose={() => setSelectedClassId(null)}
        userRole={userRole}
      />
    </div>
  );
}
