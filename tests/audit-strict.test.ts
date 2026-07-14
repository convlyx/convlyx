import { describe, it, expect } from "vitest";
import { audit } from "@/server/lib/audit";
import type { DbClient } from "@/server/lib/tenant-scope";

// Minimal fake db whose auditLog.create always throws.
function failingDb(): DbClient {
  return { auditLog: { create: async () => { throw new Error("db down"); } } } as unknown as DbClient;
}

describe("audit strict mode", () => {
  it("swallows write failures by default (best-effort)", async () => {
    await expect(
      audit({ db: failingDb(), actorEmail: "op@x.com", action: "a.b", targetType: "t", targetId: "1" }),
    ).resolves.toBeUndefined();
  });
  it("rethrows when strict", async () => {
    await expect(
      audit({ db: failingDb(), actorEmail: "op@x.com", action: "a.b", targetType: "t", targetId: "1", strict: true }),
    ).rejects.toThrow(/db down/);
  });
});
