import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { createNotification, createNotifications, formatClassTime } from "@/server/lib/notifications";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
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
      enrollments: {
        where: { status: "ENROLLED" },
        select: { studentId: true },
      },
    },
  });

  let notificationCount = 0;

  for (const cls of tomorrowClasses) {
    const timeStr = formatClassTime(new Date(cls.startsAt));
    const studentIds = cls.enrollments.map((e) => e.studentId);

    // Notify students
    if (studentIds.length > 0) {
      await createNotifications({
        db,
        tenantId: cls.tenantId,
        userIds: studentIds,
        type: "reminder.class",
        titleKey: "notifications.classReminder",
        messageKey: "notifications.classReminderMessage",
        params: { title: cls.title, time: timeStr },
        pushTitle: "Lembrete de aula",
        pushBody: `Amanhã: ${cls.title} · ${timeStr}`,
      });
      notificationCount += studentIds.length;
    }

    // Notify instructor
    await createNotification({
      db,
      tenantId: cls.tenantId,
      userId: cls.instructorId,
      type: "reminder.class",
      titleKey: "notifications.classReminder",
      messageKey: "notifications.classReminderInstructor",
      params: { title: cls.title, time: timeStr },
      pushTitle: "Lembrete de aula",
      pushBody: `Amanhã: ${cls.title} · ${timeStr}`,
    });
    notificationCount += 1;
  }

  return NextResponse.json({
    success: true,
    classesFound: tomorrowClasses.length,
    notificationsSent: notificationCount,
  });
}
