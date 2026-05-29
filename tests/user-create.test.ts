import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * `user.create` had to handle three branches in production:
 *  1. Brand-new email → invite + insert.
 *  2. Email already ACTIVE in this tenant → CONFLICT, no Supabase call.
 *  3. Email exists but INACTIVE in this tenant → reactivate in place
 *     (covers the deactivate-then-re-add flow secretaries hit).
 *
 * The previous code crashed in branch (2)/(3) with a P2002 on the User
 * primary key because `inviteUserByEmail` silently returns the existing
 * auth user, which then collides with the existing User row's id.
 */
describe("user.create", () => {
  let t: TestTenant;
  // The setup.ts mock shares a single `stubAdmin` object across every
  // createClient() call, so overriding inviteUserByEmail here affects the
  // module-level `supabaseAdmin` inside user.ts as well.
  const sharedClient = createClient("https://placeholder.supabase.co", "key") as unknown as {
    auth: { admin: { inviteUserByEmail: ReturnType<typeof vi.fn> } };
  };
  const inviteMock = sharedClient.auth.admin.inviteUserByEmail;

  beforeAll(async () => {
    t = await createTestTenant("USER_CREATE");
    // Give each invite a real auth id so user.create has something to insert.
    inviteMock.mockImplementation(async (email: string) => ({
      data: { user: { id: randomUUID(), email } },
      error: null,
    }));
  });

  afterAll(async () => {
    inviteMock.mockReset();
    await cleanupTenants(t.tenantId);
  });

  test("new email → invites and creates the user", async () => {
    inviteMock.mockClear();

    const email = `new-${randomUUID().slice(0, 8)}@test.local`;
    const created = await t.asAdmin.user.create({
      email,
      name: "Novo Aluno",
      role: "STUDENT",
      schoolId: t.schoolId,
      initialCategory: "B",
    });

    expect(created.email).toBe(email);
    expect(created.role).toBe("STUDENT");
    expect(inviteMock).toHaveBeenCalledTimes(1);

    const row = await db.user.findUniqueOrThrow({
      where: { id: created.id },
      select: { status: true, tenantId: true },
    });
    expect(row.status).toBe("ACTIVE");
    expect(row.tenantId).toBe(t.tenantId);

    // The initial course should also exist.
    const course = await db.studentCourse.findFirst({
      where: { studentId: created.id, category: "B" },
      select: { status: true },
    });
    expect(course?.status).toBe("IN_PROGRESS");
  });

  test("ACTIVE duplicate email → CONFLICT, no Supabase call", async () => {
    inviteMock.mockClear();

    const email = `dup-${randomUUID().slice(0, 8)}@test.local`;
    // Seed an ACTIVE user with this email directly.
    await db.user.create({
      data: {
        id: randomUUID(),
        tenantId: t.tenantId,
        schoolId: t.schoolId,
        email,
        name: "Existente",
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    await expect(
      t.asAdmin.user.create({
        email,
        name: "Tentativa duplicada",
        role: "STUDENT",
        schoolId: t.schoolId,
        initialCategory: "B",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "users.emailAlreadyRegistered",
    });

    // Pre-flight must short-circuit before talking to Supabase, otherwise
    // we leak an unnecessary invite call (and email).
    expect(inviteMock).not.toHaveBeenCalled();
  });

  test("INACTIVE duplicate email → reactivates in place, no Supabase call", async () => {
    inviteMock.mockClear();

    const email = `inactive-${randomUUID().slice(0, 8)}@test.local`;
    const originalId = randomUUID();
    await db.user.create({
      data: {
        id: originalId,
        tenantId: t.tenantId,
        schoolId: t.schoolId,
        email,
        name: "Antigo",
        phone: "111",
        role: "STUDENT",
        status: "INACTIVE",
      },
    });

    // Secretary re-adds the same student, with a fresh name/phone and a
    // category they want to start. Result: same row, ACTIVE, new fields.
    const result = await t.asAdmin.user.create({
      email,
      name: "Reativado",
      phone: "999",
      role: "STUDENT",
      schoolId: t.schoolId,
      initialCategory: "B",
    });

    expect(result.id).toBe(originalId);
    expect(result.email).toBe(email);

    const row = await db.user.findUniqueOrThrow({
      where: { id: originalId },
      select: { status: true, name: true, phone: true },
    });
    expect(row.status).toBe("ACTIVE");
    expect(row.name).toBe("Reativado");
    expect(row.phone).toBe("999");

    // No invite for reactivations — credentials are intact from before.
    expect(inviteMock).not.toHaveBeenCalled();

    // A fresh in-progress course exists for the requested category.
    const courses = await db.studentCourse.findMany({
      where: { studentId: originalId, category: "B" },
      select: { status: true },
    });
    expect(courses.some((c) => c.status === "IN_PROGRESS")).toBe(true);
  });

  test("INACTIVE duplicate with existing in-progress course → does not duplicate the course", async () => {
    inviteMock.mockClear();

    const email = `course-dup-${randomUUID().slice(0, 8)}@test.local`;
    const userId = randomUUID();
    await db.user.create({
      data: {
        id: userId,
        tenantId: t.tenantId,
        schoolId: t.schoolId,
        email,
        name: "Tem curso",
        role: "STUDENT",
        status: "INACTIVE",
      },
    });
    await db.studentCourse.create({
      data: {
        tenantId: t.tenantId,
        schoolId: t.schoolId,
        studentId: userId,
        category: "B",
        status: "IN_PROGRESS",
      },
    });

    await t.asAdmin.user.create({
      email,
      name: "Reativado de novo",
      role: "STUDENT",
      schoolId: t.schoolId,
      initialCategory: "B",
    });

    const courses = await db.studentCourse.findMany({
      where: { studentId: userId, category: "B", status: "IN_PROGRESS" },
    });
    expect(courses).toHaveLength(1);
  });

  // Sanity: TRPCError is the type we should be receiving from the router so
  // the global onError handler can translate the message key.
  test("CONFLICT is a TRPCError (not a raw Prisma error)", async () => {
    const email = `trpc-${randomUUID().slice(0, 8)}@test.local`;
    await db.user.create({
      data: {
        id: randomUUID(),
        tenantId: t.tenantId,
        schoolId: t.schoolId,
        email,
        name: "Existente",
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    let caught: unknown;
    try {
      await t.asAdmin.user.create({
        email,
        name: "X",
        role: "STUDENT",
        schoolId: t.schoolId,
        initialCategory: "B",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TRPCError);
  });
});
