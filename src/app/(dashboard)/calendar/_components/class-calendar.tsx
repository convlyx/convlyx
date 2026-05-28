"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";
import { trpc } from "@/lib/trpc";
import { ClassDetailDialog } from "./class-detail-dialog";
import { ExamDetailDialog } from "./exam-detail-dialog";
import { RecordExamResultDialog } from "@/app/(dashboard)/students/[id]/_components/record-exam-result-dialog";
import { CreateClassDialog } from "@/app/(dashboard)/classes/_components/create-class-dialog";
import type { UserRole } from "@/generated/prisma/enums";

type CalendarFilter = {
  schoolId?: string;
  classType?: "THEORY" | "PRACTICAL";
  instructorId?: string;
};

// Calendar event colors — themed via CSS variables defined in
// `src/app/globals.css` (both light and dark variants live there).
// Keeps FullCalendar inline-style props pointing at theme tokens so
// the events flip with the user's mode.
const enrolledColors: Record<string, { bg: string; border: string }> = {
  THEORY: { bg: "var(--calendar-theory-bg)", border: "var(--calendar-theory-border)" },
  PRACTICAL: { bg: "var(--calendar-practical-bg)", border: "var(--calendar-practical-border)" },
};

const availableColors: Record<string, { bg: string; border: string }> = {
  THEORY: {
    bg: "var(--calendar-theory-available-bg)",
    border: "var(--calendar-theory-available-border)",
  },
  PRACTICAL: {
    bg: "var(--calendar-practical-available-bg)",
    border: "var(--calendar-practical-available-border)",
  },
};

const examColors: Record<string, { bg: string; border: string }> = {
  SCHEDULED: {
    bg: "var(--calendar-exam-scheduled-bg)",
    border: "var(--calendar-exam-scheduled-border)",
  },
  PASSED: {
    bg: "var(--calendar-exam-passed-bg)",
    border: "var(--calendar-exam-passed-border)",
  },
  FAILED: {
    bg: "var(--calendar-exam-failed-bg)",
    border: "var(--calendar-exam-failed-border)",
  },
  NO_SHOW: {
    bg: "var(--calendar-exam-failed-bg)",
    border: "var(--calendar-exam-failed-border)",
  },
  CANCELLED: {
    bg: "var(--calendar-exam-cancelled-bg)",
    border: "var(--calendar-exam-cancelled-border)",
  },
};

const statusColors: Record<string, { bg: string; border: string }> = {
  CANCELLED: { bg: "var(--calendar-cancelled-bg)", border: "var(--calendar-cancelled-border)" },
  COMPLETED: { bg: "var(--calendar-completed-bg)", border: "var(--calendar-completed-border)" },
};

const EXAM_PREFIX = "exam:";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatLocalTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ClassCalendar({
  filter,
  userRole,
  userId,
}: {
  filter?: CalendarFilter;
  userRole: UserRole;
  userId: string;
}) {
  const t = useTranslations();
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [recordResultFor, setRecordResultFor] = useState<{ examId: string; studentId: string } | null>(null);
  const [createPrefill, setCreatePrefill] = useState<{ date: string; startTime: string; endTime: string; instructorId?: string; classType?: "THEORY" | "PRACTICAL" } | null>(null);

  // Staff and instructors can create classes by clicking/dragging on the calendar.
  const canCreate = userRole === "ADMIN" || userRole === "SECRETARY" || userRole === "INSTRUCTOR";

  const queryInput = useMemo(() => ({
    ...(filter?.schoolId && { schoolId: filter.schoolId }),
    ...(filter?.classType && { classType: filter.classType }),
    ...(filter?.instructorId && { instructorId: filter.instructorId }),
    ...(dateRange?.from && { from: dateRange.from }),
    ...(dateRange?.to && { to: dateRange.to }),
  }), [filter, dateRange]);

  const examQueryInput = useMemo(() => ({
    ...(filter?.schoolId && { schoolId: filter.schoolId }),
    ...(dateRange?.from && { from: dateRange.from }),
    ...(dateRange?.to && { to: dateRange.to }),
  }), [filter, dateRange]);

  const { data: classesData, isFetching } = trpc.class.list.useQuery(queryInput);
  const classes = classesData?.items;
  const { data: exams } = trpc.exam.list.useQuery(examQueryInput);

  // For students: fetch enrollments to highlight enrolled classes
  const isStudent = userRole === "STUDENT";
  const { data: enrollmentsData } = trpc.enrollment.listByStudent.useQuery(
    undefined,
    { enabled: isStudent }
  );
  const enrollments = enrollmentsData?.items;

  // Sessions the student has any enrollment row for (ENROLLED, ATTENDED, NO_SHOW)
  const studentSessionIds = useMemo(() => {
    if (!isStudent || !enrollments) return new Set<string>();
    return new Set(enrollments.map((e) => e.session.id));
  }, [isStudent, enrollments]);

  const events = useMemo(() => {
    if (!classes) return [];
    const now = new Date();
    return classes
      .filter((cls) => {
        if (!isStudent) return true;
        // Always show classes the student is part of
        if (studentSessionIds.has(cls.id)) return true;
        // For others: only show future scheduled classes with capacity
        if (cls.status !== "SCHEDULED") return false;
        if (cls.startsAt < now) return false;
        if (cls._count.enrollments >= cls.capacity) return false;
        return true;
      })
      .map((cls) => {
      const isEnrolled = studentSessionIds.has(cls.id);
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
        start: cls.startsAt,
        end: cls.endsAt,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        extendedProps: {
          kind: "class" as const,
          classType: cls.classType,
          instructor: cls.instructor.name,
          school: cls.school.name,
          status: cls.status,
          isFull,
          isEnrolled,
        },
      };
    });
  }, [classes, studentSessionIds, isStudent]);

  const examEvents = useMemo(() => {
    if (!exams) return [];
    return exams.map((exam) => {
      const colors = examColors[exam.result] ?? examColors.SCHEDULED;
      // Default 60-min slot for exams (no end stored in DB)
      const start = new Date(exam.scheduledAt);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const examTypeLabel =
        exam.type === "THEORY" ? t("exams.theory") : t("exams.practical");
      const title = `${t("exams.examLabel")} ${examTypeLabel} · ${exam.course.student.name}`;
      return {
        id: `${EXAM_PREFIX}${exam.id}`,
        title,
        start: start.toISOString(),
        end: end.toISOString(),
        backgroundColor: colors.bg,
        borderColor: colors.border,
        extendedProps: {
          kind: "exam" as const,
          studentName: exam.course.student.name,
          category: exam.course.category,
          result: exam.result,
        },
      };
    });
  }, [exams, t]);

  const allEvents = useMemo(() => [...events, ...examEvents], [events, examEvents]);

  function handleEventClick(info: EventClickArg) {
    const id = info.event.id;
    if (id.startsWith(EXAM_PREFIX)) {
      setSelectedExamId(id.slice(EXAM_PREFIX.length));
    } else {
      setSelectedClassId(id);
    }
  }

  function handleDatesSet(dateInfo: { start: Date; end: Date }) {
    setDateRange({
      from: dateInfo.start.toISOString(),
      to: dateInfo.end.toISOString(),
    });
  }

  // Click on an empty slot OR drag-select a range → open the create dialog
  // with date / start / end pre-filled. FullCalendar's `select` event fires
  // for both single-slot clicks (30min span by default) and drag-selections.
  function handleSelect(arg: DateSelectArg) {
    // Month view → all-day click. Pre-fill 09:00–10:00 since the slot has
    // no time component.
    if (arg.allDay) {
      const start = new Date(arg.start);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(10, 0, 0, 0);
      setCreatePrefill({
        date: formatLocalDate(start),
        startTime: formatLocalTime(start),
        endTime: formatLocalTime(end),
        instructorId: filter?.instructorId,
        classType: filter?.classType,
      });
      return;
    }
    const startsAt = arg.start;
    let endsAt = arg.end;
    // Single-slot click resolves to a 30min span; treat as a 1h class default
    // and visually extend the selection so the highlight matches the prefill.
    const dragMs = endsAt.getTime() - startsAt.getTime();
    if (dragMs <= 30 * 60 * 1000) {
      endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      arg.view.calendar.select({ start: startsAt, end: endsAt });
    }
    setCreatePrefill({
      date: formatLocalDate(startsAt),
      startTime: formatLocalTime(startsAt),
      endTime: formatLocalTime(endsAt),
      instructorId: filter?.instructorId,
      classType: filter?.classType,
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
            selectable={canCreate}
            selectMirror={canCreate}
            longPressDelay={250}
            eventDisplay="block"
            events={allEvents}
            eventClick={handleEventClick}
            select={canCreate ? handleSelect : undefined}
            datesSet={handleDatesSet}
            height="auto"
            eventContent={(arg) => {
              const props = arg.event.extendedProps;
              if (props.kind === "exam") {
                return (
                  <div className="p-1 text-xs leading-tight overflow-hidden">
                    <div className="flex items-center gap-1">
                      <span className="font-medium truncate">{arg.event.title}</span>
                    </div>
                    <div className="opacity-80 truncate">{props.category}</div>
                  </div>
                );
              }
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
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-red-600" />
            {t("calendar.examLabel")}
          </span>
        </div>
      )}

      <ClassDetailDialog
        classId={selectedClassId}
        open={selectedClassId !== null}
        onClose={() => setSelectedClassId(null)}
        userRole={userRole}
        userId={userId}
      />

      <ExamDetailDialog
        examId={selectedExamId}
        open={selectedExamId !== null}
        onClose={() => setSelectedExamId(null)}
        onRequestRecordResult={(examId, studentId) => {
          setSelectedExamId(null);
          setRecordResultFor({ examId, studentId });
        }}
        userRole={userRole}
        userId={userId}
      />

      {recordResultFor && (
        <RecordExamResultDialog
          examId={recordResultFor.examId}
          studentId={recordResultFor.studentId}
          open
          onClose={() => setRecordResultFor(null)}
        />
      )}

      {canCreate && (
        <CreateClassDialog
          userRole={userRole}
          userId={userId}
          hideTrigger
          open={createPrefill !== null}
          onOpenChange={(val) => { if (!val) setCreatePrefill(null); }}
          prefill={createPrefill ?? undefined}
        />
      )}
    </div>
  );
}
