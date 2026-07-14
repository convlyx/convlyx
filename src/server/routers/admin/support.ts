import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../../trpc";
import { supportListStudentsSchema, supportGetStudentSchema } from "@/lib/validations/admin";

/**
 * Support router — the ONLY admin surface that returns individual student PII.
 * Every procedure audits the access before returning (GDPR: who viewed whom,
 * when, which tenant). Read-only; no impersonation. See the sub-project 3 spec.
 */
export const supportRouter = router({
  listStudents: adminProcedure.input(supportListStudentsSchema).query(async ({ ctx, input }) => {
    const where = {
      tenantId: input.tenantId,
      role: "STUDENT" as const,
      ...(input.schoolId && { schoolId: input.schoolId }),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { user: { is: { email: { contains: input.search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      ctx.db.membership.count({ where }),
      ctx.db.membership.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: { id: true, userId: true, name: true, phone: true, status: true, user: { select: { email: true } } },
      }),
    ]);

    const ids = rows.map((r) => r.userId);
    const courseAgg = ids.length
      ? await ctx.db.studentCourse.groupBy({
          by: ["studentId"],
          where: { tenantId: input.tenantId, studentId: { in: ids }, status: "IN_PROGRESS" },
          _count: { _all: true },
        })
      : [];
    const activeByStudent = new Map(courseAgg.map((r) => [r.studentId, r._count._all]));

    await ctx.audit({
      action: "student.list_view",
      targetType: "tenant",
      targetId: input.tenantId,
      metadata: { schoolId: input.schoolId ?? null, page: input.page, count: rows.length },
    });

    return {
      total,
      items: rows.map((r) => ({
        userId: r.userId,
        membershipId: r.id,
        name: r.name,
        email: r.user.email,
        phone: r.phone,
        status: r.status,
        activeCourses: activeByStudent.get(r.userId) ?? 0,
      })),
    };
  }),

  getStudent: adminProcedure.input(supportGetStudentSchema).query(async ({ ctx, input }) => {
    const membership = await ctx.db.membership.findFirst({
      where: { tenantId: input.tenantId, userId: input.studentUserId, role: "STUDENT" },
      select: {
        name: true,
        phone: true,
        status: true,
        qualifiedCategories: true,
        createdAt: true,
        user: { select: { email: true } },
        school: { select: { name: true } },
      },
    });
    if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });

    const [courses, enrollments, exams] = await Promise.all([
      ctx.db.studentCourse.findMany({
        where: { tenantId: input.tenantId, studentId: input.studentUserId },
        orderBy: { startedAt: "desc" },
        select: { category: true, status: true, startedAt: true, completedAt: true },
      }),
      ctx.db.enrollment.findMany({
        where: { tenantId: input.tenantId, studentId: input.studentUserId },
        orderBy: { enrolledAt: "desc" },
        take: 50,
        select: {
          status: true,
          checkedInAt: true,
          enrolledAt: true,
          session: { select: { title: true, startsAt: true, classType: true } },
        },
      }),
      ctx.db.exam.findMany({
        where: { tenantId: input.tenantId, course: { is: { studentId: input.studentUserId } } },
        orderBy: { scheduledAt: "desc" },
        select: { type: true, result: true, scheduledAt: true, course: { select: { category: true } } },
      }),
    ]);

    await ctx.audit({
      action: "student.view_detail",
      targetType: "user",
      targetId: input.studentUserId,
      metadata: { tenantId: input.tenantId },
    });

    return {
      profile: {
        userId: input.studentUserId,
        name: membership.name,
        email: membership.user.email,
        phone: membership.phone,
        status: membership.status,
        joinedAt: membership.createdAt,
        qualifiedCategories: membership.qualifiedCategories,
        schoolName: membership.school.name,
      },
      courses,
      enrollments,
      exams: exams.map((e) => ({ type: e.type, result: e.result, scheduledAt: e.scheduledAt, category: e.course.category })),
    };
  }),
});
