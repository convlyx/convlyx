import { describe, it, expect } from "vitest";
import { shouldHeartbeat, HEARTBEAT_INTERVAL_MS } from "@/server/lib/heartbeat";

describe("shouldHeartbeat", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");
  it("fires when never seen", () => {
    expect(shouldHeartbeat(null, now)).toBe(true);
  });
  it("skips within the throttle window", () => {
    const recent = new Date(now.getTime() - (HEARTBEAT_INTERVAL_MS - 1000));
    expect(shouldHeartbeat(recent, now)).toBe(false);
  });
  it("fires once past the window", () => {
    const stale = new Date(now.getTime() - (HEARTBEAT_INTERVAL_MS + 1000));
    expect(shouldHeartbeat(stale, now)).toBe(true);
  });
});
