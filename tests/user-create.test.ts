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

    const mem = await db.membership.findFirst({
      where: { tenantId: t.tenantId, userId: created.id },
      select: { status: true },
    });
    expect(mem?.status).toBe("ACTIVE");

    // The initial course should also exist.
    const course = await db.studentCourse.findFirst({
      where: { studentId: created.id, category: "B" },
      select: { status: true },
    });
    expect(course?.status).toBe("IN_PROGRESS");

    // Phase 1: a matching Membership must be created for the new user.
    const membership = await db.membership.findFirst({
      where: { userId: created.id, tenantId: t.tenantId },
      select: { role: true, schoolId: true },
    });
    expect(membership?.role).toBe("STUDENT");
    expect(membership?.schoolId).toBe(t.schoolId);
  });

  test("ACTIVE duplicate email → CONFLICT, no Supabase call", async () => {
    inviteMock.mockClear();

    const email = `dup-${randomUUID().slice(0, 8)}@test.local`;
    // Seed an ACTIVE member with this email (User + active Membership).
    const dupId = randomUUID();
    await db.user.create({
      data: { id: dupId, email, name: "Existente" },
    });
    await db.membership.create({
      data: { tenantId: t.tenantId, userId: dupId, schoolId: t.schoolId, name: "Teste", role: "STUDENT", status: "ACTIVE" },
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

  test("INACTIVE membership → reactivates it, no Supabase call, global name untouched", async () => {
    inviteMock.mockClear();

    const email = `inactive-${randomUUID().slice(0, 8)}@test.local`;
    const originalId = randomUUID();
    await db.user.create({
      data: { id: originalId, email, name: "Antigo", phone: "111" },
    });
    await db.membership.create({
      data: { tenantId: t.tenantId, userId: originalId, schoolId: t.schoolId, name: "Teste", role: "STUDENT", status: "INACTIVE" },
    });

    // Secretary re-adds the same student. Their membership reactivates; the
    // global name/phone are NOT overwritten by a re-invite (those are edited
    // through user.update, so cross-tenant identities can't be silently
    // relabelled by a school that merely re-adds them).
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
      select: { name: true, phone: true },
    });
    expect(row.name).toBe("Antigo");
    expect(row.phone).toBe("111");

    // No invite for reactivations — credentials are intact from before.
    expect(inviteMock).not.toHaveBeenCalled();

    // A fresh in-progress course exists for the requested category.
    const courses = await db.studentCourse.findMany({
      where: { studentId: originalId, category: "B" },
      select: { status: true },
    });
    expect(courses.some((c) => c.status === "IN_PROGRESS")).toBe(true);

    // The membership is now ACTIVE.
    const mem = await db.membership.findFirst({
      where: { userId: originalId, tenantId: t.tenantId },
      select: { role: true, status: true },
    });
    expect(mem?.role).toBe("STUDENT");
    expect(mem?.status).toBe("ACTIVE");
  });

  test("INACTIVE duplicate with existing in-progress course → does not duplicate the course", async () => {
    inviteMock.mockClear();

    const email = `course-dup-${randomUUID().slice(0, 8)}@test.local`;
    const userId = randomUUID();
    await db.user.create({
      data: { id: userId, email, name: "Tem curso" },
    });
    await db.membership.create({
      data: { tenantId: t.tenantId, userId, schoolId: t.schoolId, name: "Teste", role: "STUDENT", status: "INACTIVE" },
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

  test("matches an existing identity case-insensitively (mixed-case email)", async () => {
    inviteMock.mockClear();

    // Existing ACTIVE member stored with a MIXED-CASE email.
    const local = `Mixed-${randomUUID().slice(0, 8)}`;
    const storedEmail = `${local}@Test.Local`;
    const ciId = randomUUID();
    await db.user.create({
      data: { id: ciId, email: storedEmail, name: "Existente" },
    });
    await db.membership.create({
      data: { tenantId: t.tenantId, userId: ciId, schoolId: t.schoolId, name: "Teste", role: "STUDENT", status: "ACTIVE" },
    });

    // Inviting the lowercase form must recognise the same identity (→ CONFLICT
    // because they're already an active member) rather than treating it as new
    // and failing later at the Supabase invite.
    await expect(
      t.asAdmin.user.create({
        email: storedEmail.toLowerCase(),
        name: "Duplicado",
        role: "STUDENT",
        schoolId: t.schoolId,
        initialCategory: "B",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "users.emailAlreadyRegistered" });
    expect(inviteMock).not.toHaveBeenCalled();
  });

  // Sanity: TRPCError is the type we should be receiving from the router so
  // the global onError handler can translate the message key.
  test("CONFLICT is a TRPCError (not a raw Prisma error)", async () => {
    const email = `trpc-${randomUUID().slice(0, 8)}@test.local`;
    const trpcId = randomUUID();
    await db.user.create({
      data: { id: trpcId, email, name: "Existente" },
    });
    await db.membership.create({
      data: { tenantId: t.tenantId, userId: trpcId, schoolId: t.schoolId, name: "Teste", role: "STUDENT", status: "ACTIVE" },
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
