import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * `user.bulkCreate` imports a roster row-by-row, reusing the same
 * create-or-reactivate core as `user.create`. It must:
 *  - create brand-new students (one invite each),
 *  - reactivate INACTIVE matches without an invite,
 *  - skip (not fail) ACTIVE duplicates,
 *  - never let one bad row abort the rest.
 */
describe("user.bulkCreate", () => {
  let t: TestTenant;
  const sharedClient = createClient("https://placeholder.supabase.co", "key") as unknown as {
    auth: { admin: { inviteUserByEmail: ReturnType<typeof vi.fn> } };
  };
  const inviteMock = sharedClient.auth.admin.inviteUserByEmail;

  beforeAll(async () => {
    t = await createTestTenant("BULK_CREATE");
    inviteMock.mockImplementation(async (email: string) => ({
      data: { user: { id: randomUUID(), email } },
      error: null,
    }));
  });

  afterAll(async () => {
    inviteMock.mockReset();
    await cleanupTenants(t.tenantId);
  });

  test("creates new students and starts their courses", async () => {
    inviteMock.mockClear();
    const a = `bulk-a-${randomUUID().slice(0, 8)}@test.local`;
    const b = `bulk-b-${randomUUID().slice(0, 8)}@test.local`;

    const { results } = await t.asAdmin.user.bulkCreate({
      schoolId: t.schoolId,
      students: [
        { name: "Aluno A", email: a, category: "B" },
        { name: "Aluno B", email: b, phone: "912345678", category: "A1" },
      ],
    });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "created")).toBe(true);
    expect(inviteMock).toHaveBeenCalledTimes(2);

    const created = await db.user.findFirst({
      where: { tenantId: t.tenantId, email: a },
      select: { role: true, status: true, studentCourses: { select: { category: true } } },
    });
    expect(created?.role).toBe("STUDENT");
    expect(created?.status).toBe("ACTIVE");
    expect(created?.studentCourses[0]?.category).toBe("B");
  });

  test("skips ACTIVE duplicates without aborting the batch", async () => {
    inviteMock.mockClear();
    const active = `bulk-active-${randomUUID().slice(0, 8)}@test.local`;
    await db.user.create({
      data: {
        id: randomUUID(),
        tenantId: t.tenantId,
        schoolId: t.schoolId,
        email: active,
        name: "Já ativo",
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    const fresh = `bulk-fresh-${randomUUID().slice(0, 8)}@test.local`;

    const { results } = await t.asAdmin.user.bulkCreate({
      schoolId: t.schoolId,
      students: [
        { name: "Já ativo", email: active, category: "B" },
        { name: "Novo", email: fresh, category: "B" },
      ],
    });

    const byEmail = Object.fromEntries(results.map((r) => [r.email, r.status]));
    expect(byEmail[active]).toBe("skipped");
    expect(byEmail[fresh]).toBe("created");
  });

  test("reactivates INACTIVE matches without an invite", async () => {
    inviteMock.mockClear();
    const email = `bulk-inactive-${randomUUID().slice(0, 8)}@test.local`;
    const id = randomUUID();
    await db.user.create({
      data: {
        id,
        tenantId: t.tenantId,
        schoolId: t.schoolId,
        email,
        name: "Antigo",
        role: "STUDENT",
        status: "INACTIVE",
      },
    });

    const { results } = await t.asAdmin.user.bulkCreate({
      schoolId: t.schoolId,
      students: [{ name: "Reativado", email, category: "B" }],
    });

    expect(results[0].status).toBe("reactivated");
    expect(inviteMock).not.toHaveBeenCalled();
    const row = await db.user.findUniqueOrThrow({
      where: { id },
      select: { status: true, name: true },
    });
    expect(row.status).toBe("ACTIVE");
    expect(row.name).toBe("Reativado");
  });
});

describe("user.checkExistingEmails", () => {
  let t: TestTenant;

  beforeAll(async () => {
    t = await createTestTenant("CHECK_EMAILS");
  });

  afterAll(async () => {
    await cleanupTenants(t.tenantId);
  });

  test("reports existing emails with status, omits unknown ones", async () => {
    const activeEmail = `check-active-${randomUUID().slice(0, 8)}@test.local`;
    const inactiveEmail = `check-inactive-${randomUUID().slice(0, 8)}@test.local`;
    const unknownEmail = `check-unknown-${randomUUID().slice(0, 8)}@test.local`;

    await db.user.createMany({
      data: [
        {
          id: randomUUID(), tenantId: t.tenantId, schoolId: t.schoolId,
          email: activeEmail, name: "A", role: "STUDENT", status: "ACTIVE",
        },
        {
          id: randomUUID(), tenantId: t.tenantId, schoolId: t.schoolId,
          email: inactiveEmail, name: "B", role: "STUDENT", status: "INACTIVE",
        },
      ],
    });

    const { existing } = await t.asAdmin.user.checkExistingEmails({
      emails: [activeEmail, inactiveEmail, unknownEmail],
    });

    const byEmail = Object.fromEntries(existing.map((e) => [e.email, e.status]));
    expect(byEmail[activeEmail]).toBe("ACTIVE");
    expect(byEmail[inactiveEmail]).toBe("INACTIVE");
    expect(byEmail[unknownEmail]).toBeUndefined();
  });
});
