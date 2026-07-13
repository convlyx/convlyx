import { describe, it, expect } from "vitest";
import { parsePlatformAdminEmails, isPlatformAdmin } from "@/server/lib/platform-admin";

describe("parsePlatformAdminEmails", () => {
  it("splits, trims, lowercases and drops blanks", () => {
    expect(parsePlatformAdminEmails(" A@x.com, b@Y.com ,, ")).toEqual(["a@x.com", "b@y.com"]);
  });
  it("returns [] for undefined/empty", () => {
    expect(parsePlatformAdminEmails(undefined)).toEqual([]);
    expect(parsePlatformAdminEmails("")).toEqual([]);
  });
});

describe("isPlatformAdmin", () => {
  const emails = "admin@convlyx.com";
  it("matches case-insensitively", () => {
    expect(isPlatformAdmin("Admin@Convlyx.com", emails)).toBe(true);
  });
  it("rejects non-members and null", () => {
    expect(isPlatformAdmin("nope@x.com", emails)).toBe(false);
    expect(isPlatformAdmin(null, emails)).toBe(false);
    expect(isPlatformAdmin(undefined, emails)).toBe(false);
  });
});
