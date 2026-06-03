import { describe, expect, test } from "vitest";
import { formatClassTime } from "@/server/lib/notifications";

/**
 * Class times are stored in UTC. Notifications must show the time in
 * Portugal wall-clock (Europe/Lisbon), not the server's UTC clock —
 * otherwise a 10:00 class shows as 09:00 in summer (WEST = UTC+1).
 */
describe("formatClassTime", () => {
  test("summer (WEST, UTC+1): 09:00 UTC renders as 10:00 Lisbon", () => {
    // 2026-07-15 09:00:00 UTC === 10:00 Lisbon (DST active)
    const startsAt = new Date("2026-07-15T09:00:00.000Z");
    expect(formatClassTime(startsAt)).toBe("15/07 às 10:00");
  });

  test("winter (WET, UTC+0): 10:00 UTC renders as 10:00 Lisbon", () => {
    // 2026-01-15 10:00:00 UTC === 10:00 Lisbon (no DST)
    const startsAt = new Date("2026-01-15T10:00:00.000Z");
    expect(formatClassTime(startsAt)).toBe("15/01 às 10:00");
  });

  test("crosses day boundary in Lisbon: 23:30 UTC summer is next-day 00:30", () => {
    // 2026-07-15 23:30 UTC === 2026-07-16 00:30 Lisbon
    const startsAt = new Date("2026-07-15T23:30:00.000Z");
    expect(formatClassTime(startsAt)).toBe("16/07 às 00:30");
  });
});
