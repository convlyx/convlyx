import { router, roleProtectedProcedure } from "../trpc";
import {
  analyticsRangeSchema,
  attendanceTrendSchema,
  enrolmentsOverTimeSchema,
  granularityFor,
  instructorWorkloadSchema,
  passRateByCategorySchema,
  type AnalyticsGranularity,
} from "@/lib/validations/analytics";
import type { LicenseCategory } from "@/lib/license-categories";

/**
 * Analytics router — ADMIN-only "Análises" tab.
 *
 * Each procedure does a small Prisma read + JS bucketing. We deliberately
 * avoid `$queryRaw` aggregations: at tenant scale (a school's data measured
 * in thousands of rows, not millions) the read+bucket approach is plenty
 * fast and keeps the code type-safe and easy to evolve. If we ever need to
 * support analytics across an entire enterprise tenant with millions of
 * rows, revisit and push the grouping into Postgres via raw SQL.
 *
 * All procedures are scoped to ctx.tenantId; passing schoolId narrows
 * further. Every procedure takes the same rangeDays (7/30/90/365); the two
 * time-series ones (enrolmentsOverTime, attendanceTrend) derive a sensible
 * bin granularity from it and return { granularity, items }.
 */

/** Day boundary helpers — UTC to avoid timezone drift across summer/winter. */
function subDaysUTC(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - days);
  return x;
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Returns the Monday (UTC midnight) of the week containing `d`. */
function mondayOfUTC(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const offset = day === 0 ? 6 : day - 1;
  const m = startOfDayUTC(d);
  m.setUTCDate(m.getUTCDate() - offset);
  return m;
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Bucket key for a given granularity. Stable, sortable, locale-free. */
function bucketKey(d: Date, granularity: AnalyticsGranularity): string {
  if (granularity === "day") return d.toISOString().slice(0, 10);
  if (granularity === "week") return mondayOfUTC(d).toISOString().slice(0, 10);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns the chronological list of bucket keys covering the period
 * [now - rangeDays, now] at the given granularity. Used to seed bucket maps
 * with zeroes so empty periods render as a 0 bar rather than going missing.
 */
function bucketKeysForRange(rangeDays: number, granularity: AnalyticsGranularity): string[] {
  const now = new Date();
  const keys: string[] = [];

  if (granularity === "day") {
    const start = startOfDayUTC(subDaysUTC(now, rangeDays - 1));
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      keys.push(d.toISOString().slice(0, 10));
    }
    return keys;
  }

  if (granularity === "week") {
    const startMonday = mondayOfUTC(subDaysUTC(now, rangeDays - 1));
    const endMonday = mondayOfUTC(now);
    for (let cursor = new Date(startMonday); cursor <= endMonday; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
      keys.push(cursor.toISOString().slice(0, 10));
    }
    return keys;
  }

  // month
  const months = Math.max(1, Math.round(rangeDays / 30));
  for (let i = months - 1; i >= 0; i--) {
    const d = startOfMonthUTC(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** Percentage change vs previous period; null if previous was 0 (undefined). */
function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const analyticsRouter = router({
  /**
   * 4 headline KPIs with delta vs the previous period of equal length.
   * Used by the snapshot row at the top of /analytics.
   */
  snapshot: roleProtectedProcedure(["ADMIN"])
    .input(analyticsRangeSchema)
    .query(async ({ ctx, input }) => {
      const rangeDays = input?.rangeDays ?? 30;
      const schoolId = input?.schoolId;
      const now = new Date();
      const periodStart = subDaysUTC(now, rangeDays);
      const prevStart = subDaysUTC(now, rangeDays * 2);

      const schoolFilter = schoolId ? { schoolId } : {};

      const [
        newStudentsCurrent,
        newStudentsPrev,
        enrolmentsCurrent,
        enrolmentsPrev,
        attendanceCurrent,
        attendancePrev,
        examsCurrent,
        examsPrev,
      ] = await Promise.all([
        ctx.db.user.count({
          where: { tenantId: ctx.tenantId, ...schoolFilter, role: "STUDENT", createdAt: { gte: periodStart } },
        }),
        ctx.db.user.count({
          where: { tenantId: ctx.tenantId, ...schoolFilter, role: "STUDENT", createdAt: { gte: prevStart, lt: periodStart } },
        }),
        ctx.db.enrollment.count({
          where: { tenantId: ctx.tenantId, ...schoolFilter, enrolledAt: { gte: periodStart } },
        }),
        ctx.db.enrollment.count({
          where: { tenantId: ctx.tenantId, ...schoolFilter, enrolledAt: { gte: prevStart, lt: periodStart } },
        }),
        ctx.db.enrollment.groupBy({
          by: ["status"],
          where: {
            tenantId: ctx.tenantId,
            ...schoolFilter,
            status: { in: ["ATTENDED", "NO_SHOW"] },
            updatedAt: { gte: periodStart },
          },
          _count: { _all: true },
        }),
        ctx.db.enrollment.groupBy({
          by: ["status"],
          where: {
            tenantId: ctx.tenantId,
            ...schoolFilter,
            status: { in: ["ATTENDED", "NO_SHOW"] },
            updatedAt: { gte: prevStart, lt: periodStart },
          },
          _count: { _all: true },
        }),
        ctx.db.exam.groupBy({
          by: ["result"],
          where: {
            tenantId: ctx.tenantId,
            ...schoolFilter,
            result: { in: ["PASSED", "FAILED", "NO_SHOW"] },
            scheduledAt: { gte: periodStart },
          },
          _count: { _all: true },
        }),
        ctx.db.exam.groupBy({
          by: ["result"],
          where: {
            tenantId: ctx.tenantId,
            ...schoolFilter,
            result: { in: ["PASSED", "FAILED", "NO_SHOW"] },
            scheduledAt: { gte: prevStart, lt: periodStart },
          },
          _count: { _all: true },
        }),
      ]);

      const attendedNow = attendanceCurrent.find((r) => r.status === "ATTENDED")?._count._all ?? 0;
      const noShowNow = attendanceCurrent.find((r) => r.status === "NO_SHOW")?._count._all ?? 0;
      const attendedPrev = attendancePrev.find((r) => r.status === "ATTENDED")?._count._all ?? 0;
      const noShowPrev = attendancePrev.find((r) => r.status === "NO_SHOW")?._count._all ?? 0;

      const attendanceTotalNow = attendedNow + noShowNow;
      const attendanceTotalPrev = attendedPrev + noShowPrev;
      const attendanceRateNow = attendanceTotalNow > 0 ? attendedNow / attendanceTotalNow : 0;
      const attendanceRatePrev = attendanceTotalPrev > 0 ? attendedPrev / attendanceTotalPrev : 0;

      const passedNow = examsCurrent.find((r) => r.result === "PASSED")?._count._all ?? 0;
      const examsTotalNow = examsCurrent.reduce((sum, r) => sum + r._count._all, 0);
      const passedPrev = examsPrev.find((r) => r.result === "PASSED")?._count._all ?? 0;
      const examsTotalPrev = examsPrev.reduce((sum, r) => sum + r._count._all, 0);
      const passRateNow = examsTotalNow > 0 ? passedNow / examsTotalNow : 0;
      const passRatePrev = examsTotalPrev > 0 ? passedPrev / examsTotalPrev : 0;

      return {
        rangeDays,
        newStudents: {
          value: newStudentsCurrent,
          delta: percentDelta(newStudentsCurrent, newStudentsPrev),
        },
        enrolments: {
          value: enrolmentsCurrent,
          delta: percentDelta(enrolmentsCurrent, enrolmentsPrev),
        },
        attendanceRate: {
          value: attendanceRateNow,
          // For rates, delta is absolute percentage-point change to keep
          // the meaning intuitive ("attendance up 4 points") rather than
          // relative-of-a-percentage which is confusing.
          delta:
            attendanceTotalPrev > 0
              ? Math.round((attendanceRateNow - attendanceRatePrev) * 1000) / 10
              : null,
          sampleSize: attendanceTotalNow,
        },
        passRate: {
          value: passRateNow,
          delta:
            examsTotalPrev > 0
              ? Math.round((passRateNow - passRatePrev) * 1000) / 10
              : null,
          sampleSize: examsTotalNow,
        },
      };
    }),

  /**
   * Enrolments bucketed over time. Granularity is derived from rangeDays:
   * 7/30d → daily, 90d → weekly, 12m → monthly. Empty buckets render as 0.
   */
  enrolmentsOverTime: roleProtectedProcedure(["ADMIN"])
    .input(enrolmentsOverTimeSchema)
    .query(async ({ ctx, input }) => {
      const rangeDays = input?.rangeDays ?? 30;
      const schoolId = input?.schoolId;
      const granularity = granularityFor(rangeDays);
      const keys = bucketKeysForRange(rangeDays, granularity);
      const since = keys.length > 0
        ? new Date(`${keys[0]}T00:00:00.000Z`)
        : subDaysUTC(new Date(), rangeDays);

      const rows = await ctx.db.enrollment.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(schoolId && { schoolId }),
          enrolledAt: { gte: since },
        },
        select: { enrolledAt: true },
      });

      const buckets = new Map<string, number>();
      for (const k of keys) buckets.set(k, 0);
      for (const row of rows) {
        const k = bucketKey(row.enrolledAt, granularity);
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
      }

      return {
        granularity,
        items: Array.from(buckets, ([bucket, count]) => ({ bucket, count })),
      };
    }),

  /**
   * Classes ran + attendance rate per bucket. Granularity follows the same
   * rangeDays mapping. Uses session.endsAt as the bucket date so buckets
   * reflect when classes actually happened.
   */
  attendanceTrend: roleProtectedProcedure(["ADMIN"])
    .input(attendanceTrendSchema)
    .query(async ({ ctx, input }) => {
      const rangeDays = input?.rangeDays ?? 30;
      const schoolId = input?.schoolId;
      const granularity = granularityFor(rangeDays);
      const keys = bucketKeysForRange(rangeDays, granularity);
      const since = keys.length > 0
        ? new Date(`${keys[0]}T00:00:00.000Z`)
        : subDaysUTC(new Date(), rangeDays);

      const sessions = await ctx.db.classSession.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(schoolId && { schoolId }),
          status: "COMPLETED",
          endsAt: { gte: since },
        },
        select: {
          endsAt: true,
          enrollments: {
            select: { status: true },
            where: { status: { in: ["ATTENDED", "NO_SHOW"] } },
          },
        },
      });

      type Bucket = { classes: number; attended: number; noShow: number };
      const buckets = new Map<string, Bucket>();
      for (const k of keys) buckets.set(k, { classes: 0, attended: 0, noShow: 0 });

      for (const s of sessions) {
        const k = bucketKey(s.endsAt, granularity);
        const b = buckets.get(k);
        if (!b) continue;
        b.classes += 1;
        for (const e of s.enrollments) {
          if (e.status === "ATTENDED") b.attended += 1;
          else if (e.status === "NO_SHOW") b.noShow += 1;
        }
      }

      return {
        granularity,
        items: Array.from(buckets, ([bucket, b]) => ({
          bucket,
          classes: b.classes,
          attendanceRate: b.attended + b.noShow > 0 ? b.attended / (b.attended + b.noShow) : 0,
          sampleSize: b.attended + b.noShow,
        })),
      };
    }),

  /**
   * Pass rate per license category over the chosen window. Only counts
   * exams whose result is one of PASSED / FAILED / NO_SHOW.
   */
  passRateByCategory: roleProtectedProcedure(["ADMIN"])
    .input(passRateByCategorySchema)
    .query(async ({ ctx, input }) => {
      const rangeDays = input?.rangeDays ?? 30;
      const schoolId = input?.schoolId;
      const since = subDaysUTC(new Date(), rangeDays);

      const exams = await ctx.db.exam.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(schoolId && { schoolId }),
          result: { in: ["PASSED", "FAILED", "NO_SHOW"] },
          scheduledAt: { gte: since },
        },
        select: {
          result: true,
          course: { select: { category: true } },
        },
      });

      type Bucket = { attempts: number; passed: number };
      const buckets = new Map<LicenseCategory, Bucket>();
      for (const e of exams) {
        const cat = e.course.category;
        const b = buckets.get(cat) ?? { attempts: 0, passed: 0 };
        b.attempts += 1;
        if (e.result === "PASSED") b.passed += 1;
        buckets.set(cat, b);
      }

      return Array.from(buckets, ([category, b]) => ({
        category,
        attempts: b.attempts,
        passed: b.passed,
        passRate: b.attempts > 0 ? b.passed / b.attempts : 0,
      })).sort((a, b) => b.attempts - a.attempts);
    }),

  /**
   * Per-instructor workload over the chosen window. Returns classes run,
   * hours taught, and attendance rate per instructor. Instructors with
   * zero classes in the period are excluded.
   */
  instructorWorkload: roleProtectedProcedure(["ADMIN"])
    .input(instructorWorkloadSchema)
    .query(async ({ ctx, input }) => {
      const rangeDays = input?.rangeDays ?? 30;
      const schoolId = input?.schoolId;
      const since = subDaysUTC(new Date(), rangeDays);

      const sessions = await ctx.db.classSession.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(schoolId && { schoolId }),
          startsAt: { gte: since },
        },
        select: {
          startsAt: true,
          endsAt: true,
          instructorId: true,
          instructor: { select: { name: true } },
          enrollments: {
            select: { status: true },
            where: { status: { in: ["ATTENDED", "NO_SHOW"] } },
          },
        },
      });

      type Bucket = {
        instructorId: string;
        name: string;
        classes: number;
        minutes: number;
        attended: number;
        noShow: number;
      };
      const buckets = new Map<string, Bucket>();
      for (const s of sessions) {
        const b = buckets.get(s.instructorId) ?? {
          instructorId: s.instructorId,
          name: s.instructor.name,
          classes: 0,
          minutes: 0,
          attended: 0,
          noShow: 0,
        };
        b.classes += 1;
        b.minutes += Math.max(0, (s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);
        for (const e of s.enrollments) {
          if (e.status === "ATTENDED") b.attended += 1;
          else if (e.status === "NO_SHOW") b.noShow += 1;
        }
        buckets.set(s.instructorId, b);
      }

      return Array.from(buckets.values())
        .map((b) => ({
          instructorId: b.instructorId,
          name: b.name,
          classes: b.classes,
          hours: Math.round((b.minutes / 60) * 10) / 10,
          attendanceRate:
            b.attended + b.noShow > 0 ? b.attended / (b.attended + b.noShow) : null,
          sampleSize: b.attended + b.noShow,
        }))
        .sort((a, b) => b.classes - a.classes);
    }),
});
