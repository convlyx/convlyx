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
import { ExamDetailDialog } from "./exam-detail-dialog";
import { RecordExamResultDialog } from "@/app/(dashboard)/students/[id]/_components/record-exam-result-dialog";
import type { UserRole } from "@/generated/prisma/enums";

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

// Exams — red/amber palette to stand out
const examColors: Record<string, { bg: string; border: string }> = {
  SCHEDULED: { bg: "#dc2626", border: "#b91c1c" },
  PASSED: { bg: "#16a34a", border: "#15803d" },
  FAILED: { bg: "#7f1d1d", border: "#991b1b" },
  NO_SHOW: { bg: "#7f1d1d", border: "#991b1b" },
  CANCELLED: { bg: "#9ca3af", border: "#6b7280" },
};

const statusColors: Record<string, { bg: string; border: string }> = {
  CANCELLED: { bg: "#ef4444", border: "#dc2626" },
  COMPLETED: { bg: "#9ca3af", border: "#6b7280" },
};

const EXAM_PREFIX = "exam:";

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

  const queryInput = useMemo(() => ({
    ...(filter?.schoolId && { schoolId: filter.schoolId }),
    ...(filter?.classType && { classType: filter.classType }),
    ...(dateRange?.from && { from: dateRange.from }),
    ...(dateRange?.to && { to: dateRange.to }),
  }), [filter, dateRange]);

  const examQueryInput = useMemo(() => ({
    ...(filter?.schoolId && { schoolId: filter.schoolId }),
    ...(dateRange?.from && { from: dateRange.from }),
    ...(dateRange?.to && { to: dateRange.to }),
  }), [filter, dateRange]);

  const { data: classes, isFetching } = trpc.class.list.useQuery(queryInput);
  const { data: exams } = trpc.exam.list.useQuery(examQueryInput);

  // For students: fetch enrollments to highlight enrolled classes
  const isStudent = userRole === "STUDENT";
  const { data: enrollments } = trpc.enrollment.listByStudent.useQuery(
    undefined,
    { enabled: isStudent }
  );

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
        if (new Date(cls.startsAt as unknown as string) < now) return false;
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
        start: cls.startsAt as unknown as string,
        end: cls.endsAt as unknown as string,
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
      const start = new Date(exam.scheduledAt as unknown as string);
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
            eventDisplay="block"
            events={allEvents}
            eventClick={handleEventClick}
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
    </div>
  );
}
