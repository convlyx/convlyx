import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

describe("tenant suspend enforcement", () => {
  let a: TestTenant;
  beforeAll(async () => { a = await createTestTenant("SUS"); });
  afterAll(async () => { await cleanupTenants(a.tenantId); });

  it("blocks all protected access when the tenant is INACTIVE, restores when ACTIVE", async () => {
    // Active → a protected procedure works.
    await expect(a.asAdmin.novidades.feed()).resolves.toBeDefined();

    await db.tenant.update({ where: { id: a.tenantId }, data: { status: "INACTIVE" } });
    await expect(a.asAdmin.novidades.feed()).rejects.toThrow();

    await db.tenant.update({ where: { id: a.tenantId }, data: { status: "ACTIVE" } });
    await expect(a.asAdmin.novidades.feed()).resolves.toBeDefined();
  });
});
