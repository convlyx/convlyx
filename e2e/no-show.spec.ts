import { test, expect } from "@playwright/test";
import { createTestClass, deleteTestClass, enrolSeededStudent } from "./fixtures/db";

/**
 * Staff path: mark a student as no-show (the "Faltou" button). Variant
 * of `mark-attendance.spec.ts` that exercises the second attendance
 * outcome — the v1 test only covered the "Presente" path.
 */
test("staff can mark an enrolled student as no-show", async ({ page }) => {
  const startsAt = new Date(Date.now() - 30 * 60_000);
  const endsAt = new Date(Date.now() + 30 * 60_000);
  const classId = await createTestClass({ status: "IN_PROGRESS", startsAt, endsAt });
  await enrolSeededStudent(classId);

  try {
    await page.goto(`/classes/${classId}`);

    await expect(page.getByRole("link", { name: /Ana Costa/ })).toBeVisible();
    const faltouButton = page.getByRole("button", { name: "Faltou" });
    await expect(faltouButton).toBeVisible();

    await faltouButton.click();

    await expect(page.getByText("Presença registada")).toBeVisible({ timeout: 10_000 });

    // After the cache invalidates, the markAttendance buttons disappear
    // because the enrolment is no longer ENROLLED. Asserting the button
    // is gone is the cleanest proof the state changed.
    await expect(faltouButton).not.toBeVisible({ timeout: 10_000 });
  } finally {
    await deleteTestClass(classId);
  }
});
