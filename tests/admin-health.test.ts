import { describe, it, expect } from "vitest";
import { classifySchoolHealth } from "@/server/lib/admin-health";

const base = { tenantActive: true, ageDays: 200, daysSinceActivity: 1, classesRecent: 40, classesPrevious: 42 };

describe("classifySchoolHealth", () => {
  it("INACTIVE when the tenant is inactive (overrides all)", () => {
    expect(classifySchoolHealth({ ...base, tenantActive: false })).toBe("INACTIVE");
  });
  it("NEW inside the new-account window", () => {
    expect(classifySchoolHealth({ ...base, ageDays: 10 })).toBe("NEW");
  });
  it("AT_RISK when quiet past the threshold", () => {
    expect(classifySchoolHealth({ ...base, daysSinceActivity: 20 })).toBe("AT_RISK");
  });
  it("AT_RISK when class volume dropped >=60% vs prior period", () => {
    expect(classifySchoolHealth({ ...base, classesRecent: 10, classesPrevious: 40 })).toBe("AT_RISK");
  });
  it("HEALTHY when active and steady", () => {
    expect(classifySchoolHealth(base)).toBe("HEALTHY");
  });
  it("no-activity (null) past new-window counts as quiet -> AT_RISK", () => {
    expect(classifySchoolHealth({ ...base, daysSinceActivity: null, classesRecent: 0, classesPrevious: 0 })).toBe("AT_RISK");
  });
});
