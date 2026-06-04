import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * End-to-end timezone handling for a school in the Azores (UTC-1 winter /
 * UTC+0 summer — one hour behind Lisbon). The recurring-class path converts
 * the entered wall-clock time to UTC server-side using the school's zone, so
 * the stored instant must reflect Azores time, not Lisbon.
 */
describe("school timezone (Azores)", () => {
  let a: TestTenant;

  beforeAll(async () => {
    a = await createTestTenant("TZ");
    await db.school.update({
      where: { id: a.schoolId },
      data: { timeZone: "Atlantic/Azores" },
    });
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  test("recurring class stores UTC derived from Azores wall-clock (summer)", async () => {
    const title = `Aula Açores ${randomUUID().slice(0, 6)}`;
    // 2026-07-15 is in summer (Azores = UTC+0), so 10:00 local == 10:00 UTC.
    await a.asAdmin.class.create({
      schoolId: a.schoolId,
      classType: "THEORY",
      title,
      capacity: 20,
      instructorId: a.instructorUserId,
      // startsAt/endsAt are required by the schema but ignored for the
      // recurring path, which recomputes each occurrence from `recurrence`.
      startsAt: "2026-07-15T10:00:00.000Z",
      endsAt: "2026-07-15T11:00:00.000Z",
      recurrence: {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startTime: "10:00",
        endTime: "11:00",
        validFrom: "2026-07-15",
        validUntil: "2026-07-15",
      },
    });

    const created = await db.classSession.findFirst({
      where: { tenantId: a.tenantId, title },
      select: { startsAt: true, endsAt: true },
    });
    expect(created?.startsAt.toISOString()).toBe("2026-07-15T10:00:00.000Z");
    expect(created?.endsAt.toISOString()).toBe("2026-07-15T11:00:00.000Z");
  });

  test("recurring class stores UTC derived from Azores wall-clock (winter)", async () => {
    const title = `Aula Açores Inverno ${randomUUID().slice(0, 6)}`;
    // 2026-01-14 is in winter (Azores = UTC-1), so 10:00 local == 11:00 UTC.
    await a.asAdmin.class.create({
      schoolId: a.schoolId,
      classType: "THEORY",
      title,
      capacity: 20,
      instructorId: a.instructorUserId,
      startsAt: "2026-01-14T11:00:00.000Z",
      endsAt: "2026-01-14T12:00:00.000Z",
      recurrence: {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startTime: "10:00",
        endTime: "11:00",
        validFrom: "2026-01-14",
        validUntil: "2026-01-14",
      },
    });

    const created = await db.classSession.findFirst({
      where: { tenantId: a.tenantId, title },
      select: { startsAt: true },
    });
    expect(created?.startsAt.toISOString()).toBe("2026-01-14T11:00:00.000Z");
  });
});
