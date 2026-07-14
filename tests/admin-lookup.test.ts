import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory, type TRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
function adminCaller(email = "op@convlyx.com"): ReturnType<typeof createCaller> {
  const ctx: TRPCContext = { db, tenantId: null, ip: null, user: { id: "op" }, userEmail: email, loadMembership: async () => null };
  return createCaller(ctx);
}

const original = process.env.PLATFORM_ADMIN_EMAILS;
let a: TestTenant;
let studentEmail: string;
beforeAll(async () => {
  process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com";
  a = await createTestTenant("LK");
  const u = await db.user.findUnique({ where: { id: a.studentUserId }, select: { email: true } });
  studentEmail = u!.email;
});
afterAll(async () => {
  if (original === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = original;
  await cleanupTenants(a.tenantId);
});

describe("admin.support.lookupUser", () => {
  it("finds a user and their memberships, and audits", async () => {
    const res = await adminCaller().admin.support.lookupUser({ email: studentEmail });
    expect(res.found).toBe(true);
    expect(res.user?.userId).toBe(a.studentUserId);
    expect(res.memberships.some((m) => m.tenantId === a.tenantId && m.role === "STUDENT")).toBe(true);
    const audits = await db.auditLog.findMany({ where: { action: "user.lookup", targetId: a.studentUserId } });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
  it("returns found:false for an unknown email (no audit)", async () => {
    const res = await adminCaller().admin.support.lookupUser({ email: "nobody-xyz@nowhere.test" });
    expect(res.found).toBe(false);
    expect(res.memberships).toEqual([]);
  });
});
