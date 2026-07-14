import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../../trpc";
import {
  adminAccountSchema,
  adminAccountChartsSchema,
  adminTimelineSchema,
} from "@/lib/validations/admin";
import { subDaysUTC, bucketKey, bucketKeysForRange, granularityFor } from "../../lib/time-buckets";

export const accountRouter = router({
  get: adminProcedure.input(adminAccountSchema).query(async ({ ctx, input }) => {
    const tenant = await ctx.db.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, name: true, status: true, createdAt: true },
    });
    if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });

    const now = new Date();
    const since30 = subDaysUTC(now, 30);
    const wauSince = subDaysUTC(now, 7);

    const [schools, byRoleRows, staff, examAgg, consents, lastSeen, lastCheckin, classes30d, wau] =
      await Promise.all([
        ctx.db.school.findMany({
          where: { tenantId: tenant.id },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            subdomain: true,
            createdAt: true,
            timeZone: true,
            cancellationNoticeHours: true,
            practicalSelfEnrollEnabled: true,
          },
        }),
        ctx.db.membership.groupBy({
          by: ["role", "status"],
          where: { tenantId: tenant.id },
          _count: { _all: true },
        }),
        ctx.db.membership.findMany({
          where: { tenantId: tenant.id, role: { in: ["ADMIN", "SECRETARY", "INSTRUCTOR"] } },
          select: {
            id: true,
            role: true,
            status: true,
            name: true,
            phone: true,
            user: { select: { email: true } },
            school: { select: { name: true } },
          },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
        ctx.db.exam.groupBy({
          by: ["result"],
          where: { tenantId: tenant.id, result: { in: ["PASSED", "FAILED", "NO_SHOW"] } },
          _count: { _all: true },
        }),
        ctx.db.consentRecord.groupBy({
          by: ["type"],
          where: { tenantId: tenant.id },
          _count: { _all: true },
        }),
        ctx.db.membership.aggregate({ where: { tenantId: tenant.id }, _max: { lastSeenAt: true } }),
        ctx.db.enrollment.aggregate({
          where: { tenantId: tenant.id, checkedInAt: { not: null } },
          _max: { checkedInAt: true },
        }),
        ctx.db.classSession.count({ where: { tenantId: tenant.id, createdAt: { gte: since30 } } }),
        ctx.db.membership.count({ where: { tenantId: tenant.id, lastSeenAt: { gte: wauSince } } }),
      ]);

    const byRole: Record<string, { active: number; inactive: number }> = {};
    for (const r of byRoleRows) {
      byRole[r.role] ??= { active: 0, inactive: 0 };
      byRole[r.role][r.status === "ACTIVE" ? "active" : "inactive"] += r._count._all;
    }
    const passed = examAgg.find((e) => e.result === "PASSED")?._count._all ?? 0;
    const examTotal = examAgg.reduce((s, e) => s + e._count._all, 0);

    const lastActiveAt =
      [lastSeen._max.lastSeenAt, lastCheckin._max.checkedInAt]
        .filter((d): d is Date => d != null)
        .sort((x, y) => y.getTime() - x.getTime())[0] ?? null;

    return {
      tenant,
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        subdomain: s.subdomain,
        createdAt: s.createdAt,
        config: {
          timeZone: s.timeZone,
          cancellationNoticeHours: s.cancellationNoticeHours,
          practicalSelfEnrollEnabled: s.practicalSelfEnrollEnabled,
        },
      })),
      snapshot: {
        activeStudents: byRole["STUDENT"]?.active ?? 0,
        instructors: byRole["INSTRUCTOR"]?.active ?? 0,
        wau,
        classes30d,
        passRate: examTotal > 0 ? passed / examTotal : null,
      },
      members: {
        byRole,
        staff: staff.map((m) => ({
          membershipId: m.id,
          name: m.name,
          email: m.user.email,
          phone: m.phone,
          role: m.role,
          status: m.status,
          schoolName: m.school.name,
        })),
      },
      consents: consents.map((c) => ({ type: c.type, count: c._count._all })),
      lastActiveAt,
    };
  }),

  /** Aggregate chart series for the account page. No individual PII. */
  charts: adminProcedure.input(adminAccountChartsSchema).query(async ({ ctx, input }) => {
    const granularity = granularityFor(input.rangeDays);
    const keys = bucketKeysForRange(input.rangeDays, granularity);
    const since = new Date(`${keys[0]}T00:00:00.000Z`);
    const scope = { tenantId: input.tenantId, ...(input.schoolId && { schoolId: input.schoolId }) };

    const [enr, sessions, funnelRows, exams, courseRows] = await Promise.all([
      ctx.db.enrollment.findMany({ where: { ...scope, enrolledAt: { gte: since } }, select: { enrolledAt: true } }),
      ctx.db.classSession.findMany({ where: { ...scope, createdAt: { gte: since } }, select: { createdAt: true, classType: true } }),
      ctx.db.enrollment.groupBy({ by: ["status"], where: { ...scope, enrolledAt: { gte: since } }, _count: { _all: true } }),
      ctx.db.exam.findMany({
        where: { ...scope, result: { in: ["PASSED", "FAILED", "NO_SHOW"] }, scheduledAt: { gte: since } },
        select: { result: true, course: { select: { category: true } } },
      }),
      ctx.db.studentCourse.groupBy({ by: ["status"], where: { ...scope }, _count: { _all: true } }),
    ]);

    const enrol = new Map(keys.map((k) => [k, 0]));
    for (const e of enr) {
      const k = bucketKey(e.enrolledAt, granularity);
      if (enrol.has(k)) enrol.set(k, enrol.get(k)! + 1);
    }

    const byType = new Map(keys.map((k) => [k, { theory: 0, practical: 0 }]));
    for (const s of sessions) {
      const k = bucketKey(s.createdAt, granularity);
      const b = byType.get(k);
      if (b) {
        if (s.classType === "THEORY") b.theory += 1;
        else b.practical += 1;
      }
    }

    const funnelOrder = ["ENROLLED", "ATTENDED", "NO_SHOW", "CANCELLED"] as const;
    const funnelMap = new Map(funnelRows.map((r) => [r.status, r._count._all]));

    const cat = new Map<string, { attempts: number; passed: number }>();
    for (const e of exams) {
      const c = e.course.category;
      const b = cat.get(c) ?? { attempts: 0, passed: 0 };
      b.attempts += 1;
      if (e.result === "PASSED") b.passed += 1;
      cat.set(c, b);
    }

    return {
      granularity,
      enrolments: Array.from(enrol, ([bucket, count]) => ({ bucket, count })),
      classesByType: Array.from(byType, ([bucket, v]) => ({ bucket, ...v })),
      funnel: funnelOrder.map((status) => ({ status, count: funnelMap.get(status) ?? 0 })),
      passByCategory: Array.from(cat, ([category, b]) => ({
        category,
        attempts: b.attempts,
        passed: b.passed,
        passRate: b.attempts ? b.passed / b.attempts : 0,
      })).sort((x, y) => y.attempts - x.attempts),
      courseCompletion: courseRows.map((r) => ({ status: r.status, count: r._count._all })),
    };
  }),

  /**
   * Recent activity timeline — aggregate, staff-attributed events only (class
   * created by staff, exam scheduled). No student names. Offset-paginated over
   * the merged (ClassSession ∪ Exam) stream sorted newest-first.
   *
   * The two sources are merged in JS, so to serve page N correctly we fetch the
   * newest `page*pageSize` from EACH table (any event in the global top-K is in
   * its own table's top-K), merge, sort, then slice the page. `total` is the sum
   * of both counts.
   */
  timeline: adminProcedure.input(adminTimelineSchema).query(async ({ ctx, input }) => {
    const need = input.page * input.pageSize;
    const skip = (input.page - 1) * input.pageSize;

    const [classes, exams, classCount, examCount] = await Promise.all([
      ctx.db.classSession.findMany({
        where: { tenantId: input.tenantId },
        orderBy: { createdAt: "desc" },
        take: need,
        select: { createdAt: true, title: true, createdBy: { select: { name: true } } },
      }),
      ctx.db.exam.findMany({
        where: { tenantId: input.tenantId },
        orderBy: { createdAt: "desc" },
        take: need,
        select: { createdAt: true, type: true },
      }),
      ctx.db.classSession.count({ where: { tenantId: input.tenantId } }),
      ctx.db.exam.count({ where: { tenantId: input.tenantId } }),
    ]);

    const items = [
      ...classes.map((c) => ({
        kind: "class_created" as const,
        at: c.createdAt,
        label: `Aula "${c.title}" criada${c.createdBy?.name ? ` por ${c.createdBy.name}` : ""}`,
      })),
      ...exams.map((e) => ({
        kind: "exam_scheduled" as const,
        at: e.createdAt,
        label: `Exame ${e.type === "THEORY" ? "teórico" : "prático"} agendado`,
      })),
    ]
      .sort((x, y) => y.at.getTime() - x.at.getTime())
      .slice(skip, skip + input.pageSize);

    return { items, total: classCount + examCount };
  }),
});
