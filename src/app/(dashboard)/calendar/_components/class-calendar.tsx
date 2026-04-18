"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, DatesSetArg } from "@fullcalendar/core";
import { trpc } from "@/lib/trpc";
import { ClassDetailDialog } from "./class-detail-dialog";

type CalendarFilter = {
  schoolId?: string;
  classType?: "THEORY" | "PRACTICAL";
  // For students: only show enrolled or all available
  showAvailable?: boolean;
};

const typeColors: Record<string, { bg: string; border: string }> = {
  THEORY: { bg: "#3b82f6", border: "#2563eb" },
  PRACTICAL: { bg: "#22c55e", border: "#16a34a" },
};

const statusColors: Record<string, { bg: string; border: string }> = {
  CANCELLED: { bg: "#ef4444", border: "#dc2626" },
  COMPLETED: { bg: "#6b7280", border: "#4b5563" },
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

  const { data: classes } = trpc.class.list.useQuery(queryInput);

  const events = useMemo(() => {
    if (!classes) return [];
    return classes.map((cls) => {
      const colors = statusColors[cls.status] ?? typeColors[cls.classType] ?? typeColors.THEORY;
      const isFull = cls._count.enrollments >= cls.capacity;

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
        },
      };
    });
  }, [classes]);

  function handleEventClick(info: EventClickArg) {
    setSelectedClassId(info.event.id);
  }

  function handleDatesSet(dateInfo: DatesSetArg) {
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
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
            list: "Lista",
          }}
          noEventsText="Sem aulas neste período"
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
                <div className="font-medium truncate">{arg.event.title}</div>
                <div className="opacity-80 truncate">{props.instructor}</div>
              </div>
            );
          }}
        />
      </div>

      <ClassDetailDialog
        classId={selectedClassId}
        open={selectedClassId !== null}
        onClose={() => setSelectedClassId(null)}
        userRole={userRole}
      />
    </div>
  );
}
