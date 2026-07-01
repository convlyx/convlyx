import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";
import { LEGAL_VERSIONS } from "@/lib/legal";

const createCaller = createCallerFactory(appRouter);
let A: TestTenant;

afterAll(async () => {
  if (A) await cleanupTenants(A.tenantId);
});

describe("consent router", () => {
  it("fresh admin needs both DPA and user terms", async () => {
    A = await createTestTenant("consent");
    const status = await A.asAdmin.consent.status();
    expect(status.needsControllerDpa).toBe(true);
    expect(status.needsUserTerms).toBe(true);
  });

  it("admin CONTROLLER_DPA accept clears both (writes DPA + own USER_TERMS)", async () => {
    await A.asAdmin.consent.accept({ type: "CONTROLLER_DPA" });
    const status = await A.asAdmin.consent.status();
    expect(status.needsControllerDpa).toBe(false);
    expect(status.needsUserTerms).toBe(false);

    const rows = await db.consentRecord.findMany({ where: { tenantId: A.tenantId } });
    expect(rows.map((r) => r.type).sort()).toEqual(["CONTROLLER_DPA", "USER_TERMS"]);
    const dpa = rows.find((r) => r.type === "CONTROLLER_DPA")!;
    expect((dpa.documentVersions as { dpa?: string }).dpa).toBe(LEGAL_VERSIONS.dpa);
  });

  it("a student cannot accept CONTROLLER_DPA (FORBIDDEN) but can accept USER_TERMS", async () => {
    const asStudent = createCaller({
      db,
      tenantId: A.tenantId,
      ip: null,
      user: { id: A.studentUserId, role: "STUDENT", tenantId: A.tenantId, schoolId: A.schoolId },
    });
    await expect(asStudent.consent.accept({ type: "CONTROLLER_DPA" })).rejects.toThrow();
    await asStudent.consent.accept({ type: "USER_TERMS" });
    const status = await asStudent.consent.status();
    expect(status.needsUserTerms).toBe(false);
    expect(status.needsControllerDpa).toBe(false); // students never need the DPA
  });
});
