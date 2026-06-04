import { describe, expect, test } from "vitest";
import { formatClassTime } from "@/server/lib/notifications";

/**
 * Class times are stored in UTC. Notifications must show the time in the
 * class's school timezone, not the server's UTC clock — otherwise a 10:00
 * class shows as 09:00 in summer (Lisbon WEST = UTC+1).
 */
describe("formatClassTime", () => {
  test("Lisbon summer (UTC+1): 09:00 UTC renders as 10:00", () => {
    const startsAt = new Date("2026-07-15T09:00:00.000Z");
    expect(formatClassTime(startsAt, "Europe/Lisbon")).toBe("15/07 às 10:00");
  });

  test("Lisbon winter (UTC+0): 10:00 UTC renders as 10:00", () => {
    const startsAt = new Date("2026-01-15T10:00:00.000Z");
    expect(formatClassTime(startsAt, "Europe/Lisbon")).toBe("15/01 às 10:00");
  });

  test("Azores summer (UTC+0): same 09:00 UTC renders as 09:00", () => {
    // The Azores are an hour behind Lisbon — the same instant is an earlier
    // wall-clock time there.
    const startsAt = new Date("2026-07-15T09:00:00.000Z");
    expect(formatClassTime(startsAt, "Atlantic/Azores")).toBe("15/07 às 09:00");
  });

  test("crosses day boundary in Lisbon: 23:30 UTC summer is next-day 00:30", () => {
    const startsAt = new Date("2026-07-15T23:30:00.000Z");
    expect(formatClassTime(startsAt, "Europe/Lisbon")).toBe("16/07 às 00:30");
  });
});
