import { describe, expect, test } from "vitest";
import { wallClockToISO, wallClockToUTC } from "@/lib/dates";

/**
 * Wall-clock -> UTC conversion must honour the school's timezone, DST-aware,
 * regardless of the server's own clock. Lisbon (mainland/Madeira) is UTC+0
 * winter / UTC+1 summer; the Azores are one hour behind (UTC-1 / UTC+0).
 */
describe("wallClockToISO", () => {
  test("Lisbon summer (UTC+1): 10:00 -> 09:00Z", () => {
    expect(wallClockToISO("2026-07-15", "10:00", "Europe/Lisbon")).toBe(
      "2026-07-15T09:00:00.000Z",
    );
  });

  test("Lisbon winter (UTC+0): 10:00 -> 10:00Z", () => {
    expect(wallClockToISO("2026-01-15", "10:00", "Europe/Lisbon")).toBe(
      "2026-01-15T10:00:00.000Z",
    );
  });

  test("Azores summer (UTC+0): 10:00 -> 10:00Z", () => {
    expect(wallClockToISO("2026-07-15", "10:00", "Atlantic/Azores")).toBe(
      "2026-07-15T10:00:00.000Z",
    );
  });

  test("Azores winter (UTC-1): 10:00 -> 11:00Z", () => {
    expect(wallClockToISO("2026-01-15", "10:00", "Atlantic/Azores")).toBe(
      "2026-01-15T11:00:00.000Z",
    );
  });
});

describe("wallClockToUTC", () => {
  test("month is 0-based (JS convention)", () => {
    // July = month 6. Azores summer -> 10:00 local == 10:00Z.
    expect(wallClockToUTC(2026, 6, 15, 10, 0, "Atlantic/Azores").toISOString()).toBe(
      "2026-07-15T10:00:00.000Z",
    );
  });
});
