import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { recordNotification, recordNotifications, dispatchPush, formatClassTime, type PushJob } from "@/server/lib/notifications";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Pin to Dublin (eu-west-1) to co-locate with Supabase — avoids transatlantic DB latency.
export const preferredRegion = "dub1";

export async function GET(request: NextRequest) {
  // Rate limit: 2 requests per minute
  const ip = getClientIp(request.headers);
  const { success } = await rateLimit({ key: `cron:${ip}`, limit: 2, windowMs: 60000 });
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  // Find all scheduled classes for tomorrow
  const tomorrowClasses = await db.classSession.findMany({
    where: {
      status: "SCHEDULED",
      startsAt: { gte: tomorrow, lt: dayAfter },
    },
    select: {
      id: true,
      title: true,
      tenantId: true,
      startsAt: true,
      instructorId: true,
      school: { select: { timeZone: true } },
      enrollments: {
        where: { status: "ENROLLED" },
        select: { studentId: true },
      },
    },
  });

  const jobs: (PushJob | null)[] = [];
  let notificationCount = 0;

  for (const cls of tomorrowClasses) {
    const timeStr = formatClassTime(new Date(cls.startsAt), cls.school.timeZone);
    const studentIds = cls.enrollments.map((e) => e.studentId);

    // Notify students
    if (studentIds.length > 0) {
      jobs.push(
        await recordNotifications(db, {
          tenantId: cls.tenantId,
          userIds: studentIds,
          type: "reminder.class",
          titleKey: "notifications.classReminder",
          messageKey: "notifications.classReminderMessage",
          params: { title: cls.title, time: timeStr },
          pushTitle: "Lembrete de aula",
          pushBody: `Amanhã: ${cls.title} · ${timeStr}`,
        }),
      );
      notificationCount += studentIds.length;
    }

    // Notify instructor
    jobs.push(
      await recordNotification(db, {
        tenantId: cls.tenantId,
        userId: cls.instructorId,
        type: "reminder.class",
        titleKey: "notifications.classReminder",
        messageKey: "notifications.classReminderInstructor",
        params: { title: cls.title, time: timeStr },
        pushTitle: "Lembrete de aula",
        pushBody: `Amanhã: ${cls.title} · ${timeStr}`,
      }),
    );
    notificationCount += 1;
  }

  // Find all scheduled exams for tomorrow
  const tomorrowExams = await db.exam.findMany({
    where: {
      result: "SCHEDULED",
      scheduledAt: { gte: tomorrow, lt: dayAfter },
    },
    select: {
      id: true,
      type: true,
      tenantId: true,
      scheduledAt: true,
      instructorId: true,
      course: {
        select: { student: { select: { id: true, name: true, school: { select: { timeZone: true } } } } },
      },
    },
  });

  let examNotificationCount = 0;

  for (const exam of tomorrowExams) {
    const timeStr = formatClassTime(new Date(exam.scheduledAt), exam.course.student.school.timeZone);
    const examTypeLabel = exam.type === "THEORY" ? "teórico" : "prático";

    // Notify student
    jobs.push(
      await recordNotification(db, {
        tenantId: exam.tenantId,
        userId: exam.course.student.id,
        type: "reminder.exam",
        titleKey:
          exam.type === "THEORY"
            ? "notifications.theoryExamScheduledTitle"
            : "notifications.practicalExamScheduledTitle",
        messageKey: "notifications.examReminderStudent",
        params: { examType: examTypeLabel, time: timeStr },
        pushTitle: "Lembrete de exame",
        pushBody: `Amanhã: exame ${examTypeLabel} · ${timeStr}`,
      }),
    );
    examNotificationCount += 1;

    // Notify accompanying instructor (if any)
    if (exam.instructorId) {
      jobs.push(
        await recordNotification(db, {
          tenantId: exam.tenantId,
          userId: exam.instructorId,
          type: "reminder.exam",
          titleKey: "notifications.examAccompanyTitle",
          messageKey: "notifications.examReminderInstructor",
          params: { student: exam.course.student.name, time: timeStr },
          pushTitle: "Lembrete de exame",
          pushBody: `Amanhã: exame de ${exam.course.student.name} · ${timeStr}`,
        }),
      );
      examNotificationCount += 1;
    }
  }

  dispatchPush(db, jobs);

  return NextResponse.json({
    success: true,
    classesFound: tomorrowClasses.length,
    examsFound: tomorrowExams.length,
    notificationsSent: notificationCount + examNotificationCount,
  });
}
