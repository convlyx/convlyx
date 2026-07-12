import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { withTenant } from "@/server/lib/tenant-scope";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * Direct tests of the `withTenant` Prisma extension. The procedure-level
 * tests in `isolation.test.ts` already cover the happy path (procedures
 * pass tenantId correctly and the extension is transparent). These tests
 * deliberately *omit* tenant filters in the where/data to prove the
 * extension catches a "forgot to filter" bug at the ORM layer.
 */
describe("withTenant extension", () => {
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestTenant("A"), createTestTenant("B")]);
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId, b.tenantId);
  });

  // User is no longer tenant-scoped (it's the global identity); these
  // extension tests use Membership, the per-tenant row that replaced it.
  test("findMany with NO where clause only returns the current tenant's rows", async () => {
    const scoped = withTenant(db, a.tenantId);
    const memberships = await scoped.membership.findMany();
    const ids = memberships.map((m) => m.userId);

    expect(ids).toEqual(
      expect.arrayContaining([a.adminUserId, a.instructorUserId, a.studentUserId]),
    );
    expect(ids).not.toContain(b.adminUserId);
    expect(ids).not.toContain(b.studentUserId);
  });

  test("findFirst with NO where clause only sees the current tenant", async () => {
    const scoped = withTenant(db, a.tenantId);
    const session = await scoped.classSession.findFirst();
    expect(session?.tenantId).toBe(a.tenantId);
  });

  test("count is scoped — counts only current-tenant rows", async () => {
    const aScoped = withTenant(db, a.tenantId);
    const bScoped = withTenant(db, b.tenantId);
    const aTotal = await aScoped.membership.count();
    const bTotal = await bScoped.membership.count();
    expect(aTotal).toBe(3);
    expect(bTotal).toBe(3);
  });

  test("explicit cross-tenant where is overridden — the extension always wins", async () => {
    // Caller is acting as tenant A; deliberately passes B's tenantId.
    // Result must be A's row(s), not B's.
    const scoped = withTenant(db, a.tenantId);
    const memberships = await scoped.membership.findMany({
      where: { tenantId: b.tenantId, role: "ADMIN" },
    });
    const ids = memberships.map((m) => m.userId);
    expect(ids).toContain(a.adminUserId);
    expect(ids).not.toContain(b.adminUserId);
  });

  test("update with NO tenant filter cannot reach into another tenant", async () => {
    const scoped = withTenant(db, a.tenantId);
    // Try to rename B's admin membership via A's scoped client.
    const result = await scoped.membership.updateMany({
      where: { userId: b.adminUserId },
      data: { name: "Tampered" },
    });

    expect(result.count).toBe(0);
    // B's admin membership is unchanged.
    const bAdmin = await db.membership.findFirst({
      where: { tenantId: b.tenantId, userId: b.adminUserId },
    });
    expect(bAdmin?.name).not.toBe("Tampered");
  });

  test("delete with NO tenant filter cannot delete from another tenant", async () => {
    const scoped = withTenant(db, a.tenantId);
    const result = await scoped.notification.deleteMany({
      where: { userId: b.adminUserId },
    });
    expect(result.count).toBe(0);
  });

  test("create injects tenantId — even when caller forgets to set it", async () => {
    const scoped = withTenant(db, a.tenantId);
    // Deliberately use a different tenantId in the data; the extension
    // must override it with the caller's bound tenantId.
    const notif = await scoped.notification.create({
      data: {
        tenantId: b.tenantId, // <- bogus, should be overridden
        schoolId: a.schoolId,
        userId: a.adminUserId,
        type: "test.tenant-scope",
        title: "test",
        message: "test",
      },
      select: { id: true, tenantId: true },
    });
    expect(notif.tenantId).toBe(a.tenantId);
    await db.notification.delete({ where: { id: notif.id } });
  });

  test("findUnique is forbidden on tenant-scoped models", async () => {
    const scoped = withTenant(db, a.tenantId);
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (scoped as any).membership.findUnique({
        where: { tenantId_userId: { tenantId: a.tenantId, userId: a.adminUserId } },
      }),
    ).rejects.toThrow(/tenant-scope.*findUnique.*forbidden/i);
  });

  test("non-tenant models (Tenant) are unaffected by scoping", async () => {
    const scoped = withTenant(db, a.tenantId);
    // The Tenant table itself isn't scoped — both tenants should be visible.
    const tenants = await scoped.tenant.findMany({
      where: { id: { in: [a.tenantId, b.tenantId] } },
    });
    expect(tenants.length).toBe(2);
  });
});
