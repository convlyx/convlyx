import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import type { TRPCContext } from "@/server/trpc";

const createCaller = createCallerFactory(appRouter);

/** Build an admin-context caller. When email is on the allowlist it passes adminProcedure. */
function adminCaller(userEmail: string | null): ReturnType<typeof createCaller> {
  const ctx: TRPCContext = {
    db,
    tenantId: null,
    ip: null,
    user: userEmail ? { id: "op-1" } : null,
    userEmail,
    loadMembership: async () => null,
  };
  return createCaller(ctx);
}

const originalEmails = process.env.PLATFORM_ADMIN_EMAILS;
beforeAll(() => {
  process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com";
});
afterAll(() => {
  process.env.PLATFORM_ADMIN_EMAILS = originalEmails;
});

describe("adminProcedure auth", () => {
  it("allows an allowlisted operator", async () => {
    await expect(adminCaller("op@convlyx.com").admin.portfolio.ping()).resolves.toEqual({ ok: true });
  });
  it("rejects a non-allowlisted email", async () => {
    await expect(adminCaller("intruder@x.com").admin.portfolio.ping()).rejects.toThrow();
  });
  it("rejects unauthenticated", async () => {
    await expect(adminCaller(null).admin.portfolio.ping()).rejects.toThrow();
  });
});

describe("admin.portfolio.kpis + trends", () => {
  it("kpis returns non-negative counts including at-risk", async () => {
    const k = await adminCaller("op@convlyx.com").admin.portfolio.kpis();
    expect(k.schools).toBeGreaterThanOrEqual(0);
    expect(k.activeMembers).toBeGreaterThanOrEqual(0);
    expect(k.classes30d).toBeGreaterThanOrEqual(0);
    expect(k.atRiskCount).toBeGreaterThanOrEqual(0);
  });
  it("trends returns aligned bucket arrays", async () => {
    const t = await adminCaller("op@convlyx.com").admin.portfolio.trends({ rangeDays: 90 });
    expect(["day", "week", "month"]).toContain(t.granularity);
    expect(Array.isArray(t.newSchools)).toBe(true);
    expect(Array.isArray(t.activity)).toBe(true);
    expect(t.newSchools.length).toBe(t.activity.length);
  });
});

describe("admin.portfolio.overview", () => {
  it("paginates and returns health-annotated rows", async () => {
    const res = await adminCaller("op@convlyx.com").admin.portfolio.overview({
      page: 1, pageSize: 10, status: "ALL", risk: "ALL", sort: "name",
    });
    expect(res).toHaveProperty("total");
    expect(Array.isArray(res.items)).toBe(true);
    if (res.items.length) {
      const row = res.items[0];
      expect(row).toHaveProperty("health");
      expect(row).toHaveProperty("wau");
      expect(row.sparkline.length).toBe(8);
    }
  });
  it("search narrows results", async () => {
    const res = await adminCaller("op@convlyx.com").admin.portfolio.overview({
      page: 1, pageSize: 10, search: "zzz-no-such-school", status: "ALL", risk: "ALL", sort: "name",
    });
    expect(res.total).toBe(0);
    expect(res.items.length).toBe(0);
  });
});
