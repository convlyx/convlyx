import { describe, it, expect } from "vitest";
import { buildAuditWhere } from "@/server/lib/audit-query";

const now = new Date("2026-07-14T12:00:00.000Z");

describe("buildAuditWhere", () => {
  it("is empty when nothing is set", () => {
    expect(buildAuditWhere({}, now)).toEqual({});
  });
  it("filters by action, actor and exact target", () => {
    expect(buildAuditWhere({ action: "student.view_detail", actor: "op@x.com", target: "u1" }, now)).toEqual({
      action: "student.view_detail",
      actorEmail: "op@x.com",
      targetId: "u1",
    });
  });
  it("adds a createdAt lower bound for sinceDays", () => {
    const w = buildAuditWhere({ sinceDays: 7 }, now) as { createdAt?: { gte: Date } };
    expect(w.createdAt?.gte).toEqual(new Date("2026-07-07T12:00:00.000Z"));
  });
  it("ignores sinceDays <= 0", () => {
    expect(buildAuditWhere({ sinceDays: 0 }, now)).toEqual({});
  });
});
