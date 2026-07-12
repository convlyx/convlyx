import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * GDPR erasure (delete / anonymize) is per-membership: removing a person from
 * one school must not touch the schools they still belong to, and the global
 * identity (User row + login) is only destroyed when their LAST membership goes.
 */
describe("per-membership GDPR erasure", () => {
  let A: TestTenant;
  let B: TestTenant;

  beforeAll(async () => {
    A = await createTestTenant("ERASE_A");
    B = await createTestTenant("ERASE_B");
  });
  afterAll(async () => {
    await cleanupTenants(A.tenantId, B.tenantId);
  });

  /** A shared identity: one User + a membership in each of A and B. */
  async function makeMultiTenantUser(email: string) {
    const uid = randomUUID();
    await db.user.create({
      data: { id: uid, email, name: "Global" },
    });
    await db.membership.createMany({
      data: [
        { tenantId: A.tenantId, userId: uid, schoolId: A.schoolId, name: "NameA", role: "STUDENT" },
        { tenantId: B.tenantId, userId: uid, schoolId: B.schoolId, name: "NameB", role: "STUDENT" },
      ],
    });
    return uid;
  }

  test("delete in one school removes only that membership when they belong elsewhere", async () => {
    const uid = await makeMultiTenantUser(`del-multi-${randomUUID().slice(0, 8)}@test.local`);

    await B.asAdmin.user.delete({ id: uid });

    // B's membership is gone; A's membership + the global identity remain.
    expect(await db.membership.findFirst({ where: { tenantId: B.tenantId, userId: uid } })).toBeNull();
    expect(await db.membership.findFirst({ where: { tenantId: A.tenantId, userId: uid } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: uid } })).not.toBeNull();
  });

  test("deleting the last school removes the global identity", async () => {
    const uid = randomUUID();
    await db.user.create({
      data: { id: uid, email: `del-solo-${randomUUID().slice(0, 8)}@test.local`, name: "Solo" },
    });
    await db.membership.create({
      data: { tenantId: A.tenantId, userId: uid, schoolId: A.schoolId, name: "Solo", role: "STUDENT" },
    });

    await A.asAdmin.user.delete({ id: uid });

    expect(await db.user.findUnique({ where: { id: uid } })).toBeNull();
    expect(await db.membership.findFirst({ where: { userId: uid } })).toBeNull();
  });

  test("anonymize in a non-last school keeps the global identity + other memberships", async () => {
    const email = `anon-multi-${randomUUID().slice(0, 8)}@test.local`;
    const uid = await makeMultiTenantUser(email);

    await B.asAdmin.user.anonymize({ id: uid });

    const memB = await db.membership.findFirst({ where: { tenantId: B.tenantId, userId: uid } });
    expect(memB?.name).toBe("Anonimizado");
    expect(memB?.status).toBe("INACTIVE");

    const memA = await db.membership.findFirst({ where: { tenantId: A.tenantId, userId: uid } });
    expect(memA?.name).toBe("NameA");
    expect(memA?.status).toBe("ACTIVE");

    // Global email untouched — they can still log into school A.
    const user = await db.user.findUnique({ where: { id: uid } });
    expect(user?.email).toBe(email);
  });

  test("anonymize in the last school scrubs the global identity", async () => {
    const uid = randomUUID();
    const email = `anon-solo-${randomUUID().slice(0, 8)}@test.local`;
    await db.user.create({
      data: { id: uid, email, name: "Real" },
    });
    await db.membership.create({
      data: { tenantId: A.tenantId, userId: uid, schoolId: A.schoolId, name: "Real", role: "STUDENT" },
    });

    await A.asAdmin.user.anonymize({ id: uid });

    const user = await db.user.findUniqueOrThrow({ where: { id: uid } });
    expect(user.email).not.toBe(email);
    expect(user.email).toContain("@convlyx.invalid");
    expect(user.name).toBe("Anonimizado");
  });
});
