import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { recordNotification, recordNotifications } from "@/server/lib/notifications";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

let A: TestTenant;
afterAll(async () => { if (A) await cleanupTenants(A.tenantId); });

describe("recordNotification", () => {
  it("writes a row and returns a PushJob (push text falls back to i18n keys)", async () => {
    A = await createTestTenant("notif");
    const job = await recordNotification(db, {
      tenantId: A.tenantId,
      userId: A.studentUserId,
      type: "class.assigned",
      titleKey: "notifications.newClassAssigned",
      messageKey: "notifications.newClassAssigned",
    });
    expect(job).not.toBeNull();
    expect(job!.userIds).toEqual([A.studentUserId]);
    expect(typeof job!.title).toBe("string");
    const rows = await db.notification.findMany({ where: { tenantId: A.tenantId, userId: A.studentUserId } });
    expect(rows.length).toBe(1);
    expect(rows[0].type).toBe("class.assigned");
  });

  it("returns null for an unknown user", async () => {
    const job = await recordNotification(db, {
      tenantId: A.tenantId,
      userId: "00000000-0000-0000-0000-000000000000",
      type: "x", titleKey: "x", messageKey: "x",
    });
    expect(job).toBeNull();
  });

  it("recordNotifications skips unknown users and returns recipients", async () => {
    const job = await recordNotifications(db, {
      tenantId: A.tenantId,
      userIds: [A.instructorUserId, "00000000-0000-0000-0000-000000000000"],
      type: "class.created", titleKey: "notifications.newClass", messageKey: "notifications.newClass",
    });
    expect(job!.userIds).toEqual([A.instructorUserId]);
  });

  it("rolls back the notification row when the transaction throws", async () => {
    const uid = A.instructorUserId;
    const before = await db.notification.count({ where: { tenantId: A.tenantId, userId: uid } });
    await expect(
      db.$transaction(async (tx) => {
        await recordNotification(tx, {
          tenantId: A.tenantId,
          userId: uid,
          type: "class.created",
          titleKey: "notifications.newClass",
          messageKey: "notifications.newClass",
        });
        throw new Error("boom"); // force rollback after the insert
      }),
    ).rejects.toThrow("boom");
    const after = await db.notification.count({ where: { tenantId: A.tenantId, userId: uid } });
    expect(after).toBe(before); // no orphaned row
  });
});
