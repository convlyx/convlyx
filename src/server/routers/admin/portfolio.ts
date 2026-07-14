import { router, adminProcedure } from "../../trpc";
import { adminTrendsSchema, adminOverviewSchema } from "@/lib/validations/admin";
import { classifySchoolHealth } from "../../lib/admin-health";
import { subDaysUTC, bucketKey, bucketKeysForRange, granularityFor } from "../../lib/time-buckets";

const DAY_MS = 86_400_000;

export const portfolioRouter = router({
  // Placeholder to prove auth wiring; kept as a cheap health-check endpoint.
  ping: adminProcedure.query(() => ({ ok: true as const })),

  /** Four headline platform KPIs for the overview page. */
  kpis: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const since30 = subDaysUTC(now, 30);
    const prev60 = subDaysUTC(now, 60);

    const [schoolCount, activeMembers, classes30d, schoolRows, classDates, checkinRows, lastSeenRows, lastClassRows] =
      await Promise.all([
        ctx.db.school.count(),
        ctx.db.membership.count({ where: { status: "ACTIVE" } }),
        ctx.db.classSession.count({ where: { createdAt: { gte: since30 } } }),
        ctx.db.school.findMany({
          select: { id: true, createdAt: true, tenant: { select: { status: true } } },
        }),
        ctx.db.classSession.findMany({
          where: { createdAt: { gte: prev60 } },
          select: { schoolId: true, createdAt: true },
        }),
        ctx.db.enrollment.groupBy({
          by: ["schoolId"],
          where: { checkedInAt: { not: null } },
          _max: { checkedInAt: true },
        }),
        ctx.db.membership.groupBy({
          by: ["schoolId"],
          where: { lastSeenAt: { not: null } },
          _max: { lastSeenAt: true },
        }),
        // Most recent class created per school (all-time) — a real activity
        // signal even before check-ins / heartbeat data accrue.
        ctx.db.classSession.groupBy({ by: ["schoolId"], _max: { createdAt: true } }),
      ]);

    const recent = new Map<string, number>();
    const prev = new Map<string, number>();
    for (const c of classDates) {
      const map = c.createdAt >= since30 ? recent : prev;
      map.set(c.schoolId, (map.get(c.schoolId) ?? 0) + 1);
    }
    const lastCheckin = new Map(checkinRows.map((r) => [r.schoolId, r._max.checkedInAt]));
    const lastSeen = new Map(lastSeenRows.map((r) => [r.schoolId, r._max.lastSeenAt]));
    const lastClass = new Map(lastClassRows.map((r) => [r.schoolId, r._max.createdAt]));

    let atRiskCount = 0;
    for (const s of schoolRows) {
      const dates = [lastCheckin.get(s.id), lastSeen.get(s.id), lastClass.get(s.id)].filter(
        (d): d is Date => d != null,
      );
      const mostRecent = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
      const daysSinceActivity = mostRecent
        ? Math.floor((now.getTime() - mostRecent.getTime()) / DAY_MS)
        : null;
      const health = classifySchoolHealth({
        tenantActive: s.tenant.status === "ACTIVE",
        ageDays: Math.floor((now.getTime() - s.createdAt.getTime()) / DAY_MS),
        daysSinceActivity,
        classesRecent: recent.get(s.id) ?? 0,
        classesPrevious: prev.get(s.id) ?? 0,
      });
      if (health === "AT_RISK") atRiskCount += 1;
    }

    return { schools: schoolCount, activeMembers, classes30d, atRiskCount };
  }),

  /** New-schools + activity (classes/enrolments) time series for the overview charts. */
  trends: adminProcedure.input(adminTrendsSchema).query(async ({ ctx, input }) => {
    const rangeDays = input?.rangeDays ?? 90;
    const granularity = granularityFor(rangeDays);
    const keys = bucketKeysForRange(rangeDays, granularity);
    const since = new Date(`${keys[0]}T00:00:00.000Z`);

    const [schools, classes, enrolments] = await Promise.all([
      ctx.db.school.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      ctx.db.classSession.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      ctx.db.enrollment.findMany({ where: { enrolledAt: { gte: since } }, select: { enrolledAt: true } }),
    ]);

    const newSchools = new Map(keys.map((k) => [k, 0]));
    for (const s of schools) {
      const k = bucketKey(s.createdAt, granularity);
      if (newSchools.has(k)) newSchools.set(k, newSchools.get(k)! + 1);
    }
    const activity = new Map(keys.map((k) => [k, { classes: 0, enrolments: 0 }]));
    for (const c of classes) {
      const k = bucketKey(c.createdAt, granularity);
      if (activity.has(k)) activity.get(k)!.classes += 1;
    }
    for (const e of enrolments) {
      const k = bucketKey(e.enrolledAt, granularity);
      if (activity.has(k)) activity.get(k)!.enrolments += 1;
    }

    return {
      granularity,
      newSchools: Array.from(newSchools, ([bucket, count]) => ({ bucket, count })),
      activity: Array.from(activity, ([bucket, v]) => ({ bucket, ...v })),
    };
  }),

  /**
   * Paginated, searchable, health-annotated list of schools for the overview
   * table. Filters + pages the schools first (cheap), then runs grouped
   * aggregates scoped to the page's schoolIds only. NOTE: the `risk` filter and
   * `students`/`classes30d` sorts apply to the enriched current page, so a
   * risk-filtered `total` reflects the pre-filter school count — acceptable for
   * an internal tool; upgrade by materializing health if exact totals matter.
   */
  overview: adminProcedure.input(adminOverviewSchema).query(async ({ ctx, input }) => {
    const now = new Date();
    const since30 = subDaysUTC(now, 30);
    const prev60 = subDaysUTC(now, 60);
    const wauSince = subDaysUTC(now, 7);
    const sparkSince = subDaysUTC(now, 56); // 8 weeks

    const tenantWhere =
      input.status === "ALL" ? {} : { tenant: { is: { status: input.status } } };
    const searchWhere = input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { subdomain: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const where = { ...tenantWhere, ...searchWhere };

    const dbOrderBy =
      input.sort === "createdAt" ? { createdAt: "desc" as const } : { name: "asc" as const };

    // Enrich the FULL name/status-filtered set (school count is bounded for an
    // internal tool), so the risk filter + computed sorts are correct and the
    // returned total reflects the risk-filtered count — then paginate in JS.
    const schools = await ctx.db.school.findMany({
      where,
      orderBy: dbOrderBy,
      select: {
        id: true,
        name: true,
        subdomain: true,
        createdAt: true,
        tenantId: true,
        tenant: { select: { name: true, status: true } },
      },
    });
    const ids = schools.map((s) => s.id);
    if (ids.length === 0) return { items: [], total: 0 };

    const [students, wau, classesRecent, classesPrev, passAgg, checkin, lastSeenRows, lastClassRows, sparkRows] =
      await Promise.all([
        ctx.db.membership.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, role: "STUDENT", status: "ACTIVE" }, _count: { _all: true } }),
        ctx.db.membership.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, lastSeenAt: { gte: wauSince } }, _count: { _all: true } }),
        ctx.db.classSession.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, createdAt: { gte: since30 } }, _count: { _all: true } }),
        ctx.db.classSession.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, createdAt: { gte: prev60, lt: since30 } }, _count: { _all: true } }),
        ctx.db.exam.groupBy({ by: ["schoolId", "result"], where: { schoolId: { in: ids }, result: { in: ["PASSED", "FAILED", "NO_SHOW"] } }, _count: { _all: true } }),
        ctx.db.enrollment.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, checkedInAt: { not: null } }, _max: { checkedInAt: true } }),
        ctx.db.membership.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, lastSeenAt: { not: null } }, _max: { lastSeenAt: true } }),
        ctx.db.classSession.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids } }, _max: { createdAt: true } }),
        ctx.db.enrollment.findMany({ where: { schoolId: { in: ids }, enrolledAt: { gte: sparkSince } }, select: { schoolId: true, enrolledAt: true } }),
      ]);

    const num = (rows: { schoolId: string; _count: { _all: number } }[]) =>
      new Map(rows.map((r) => [r.schoolId, r._count._all]));
    const students$ = num(students);
    const wau$ = num(wau);
    const rec$ = num(classesRecent);
    const prev$ = num(classesPrev);
    const lastCheckin$ = new Map(checkin.map((r) => [r.schoolId, r._max.checkedInAt]));
    const lastSeen$ = new Map(lastSeenRows.map((r) => [r.schoolId, r._max.lastSeenAt]));
    const lastClass$ = new Map(lastClassRows.map((r) => [r.schoolId, r._max.createdAt]));

    const passBySchool = new Map<string, { passed: number; total: number }>();
    for (const r of passAgg) {
      const b = passBySchool.get(r.schoolId) ?? { passed: 0, total: 0 };
      b.total += r._count._all;
      if (r.result === "PASSED") b.passed += r._count._all;
      passBySchool.set(r.schoolId, b);
    }

    // 8 weekly sparkline buckets of enrolments per school.
    const weekIndex = (d: Date) =>
      Math.floor((d.getTime() - sparkSince.getTime()) / (7 * DAY_MS));
    const spark = new Map<string, number[]>(ids.map((id) => [id, Array(8).fill(0)]));
    for (const r of sparkRows) {
      const arr = spark.get(r.schoolId)!;
      const i = weekIndex(r.enrolledAt);
      if (i >= 0 && i < 8) arr[i] += 1;
    }

    let items = schools.map((s) => {
      const ageDays = Math.floor((now.getTime() - s.createdAt.getTime()) / DAY_MS);
      const dates = [lastCheckin$.get(s.id), lastSeen$.get(s.id), lastClass$.get(s.id)].filter(
        (d): d is Date => d != null,
      );
      const mostRecent = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
      const daysSinceActivity = mostRecent
        ? Math.floor((now.getTime() - mostRecent.getTime()) / DAY_MS)
        : null;
      const classes30d = rec$.get(s.id) ?? 0;
      const pass = passBySchool.get(s.id);
      return {
        schoolId: s.id,
        tenantId: s.tenantId,
        schoolName: s.name,
        tenantName: s.tenant.name,
        subdomain: s.subdomain,
        tenantStatus: s.tenant.status,
        ageDays,
        activeStudents: students$.get(s.id) ?? 0,
        wau: wau$.get(s.id) ?? 0,
        classes30d,
        passRate: pass && pass.total > 0 ? pass.passed / pass.total : null,
        health: classifySchoolHealth({
          tenantActive: s.tenant.status === "ACTIVE",
          ageDays,
          daysSinceActivity,
          classesRecent: classes30d,
          classesPrevious: prev$.get(s.id) ?? 0,
        }),
        sparkline: spark.get(s.id) ?? Array(8).fill(0),
      };
    });

    if (input.risk !== "ALL") items = items.filter((i) => i.health === input.risk);
    if (input.sort === "students") items.sort((a, b) => b.activeStudents - a.activeStudents);
    if (input.sort === "classes30d") items.sort((a, b) => b.classes30d - a.classes30d);

    const filteredTotal = items.length;
    const paged = items.slice((input.page - 1) * input.pageSize, input.page * input.pageSize);
    return { items: paged, total: filteredTotal };
  }),
});
