import { test, expect } from "@playwright/test";
import { createTestClass, deleteTestClass, enrolSeededStudent } from "./fixtures/db";

/**
 * Staff path: mark a student as attended for an in-progress class.
 *
 * `canMarkAttendance` in the UI gates on the class being IN_PROGRESS or
 * COMPLETED, so the ephemeral class is created already IN_PROGRESS.
 */
test("staff can mark an enrolled student as attended", async ({ page }) => {
  const startsAt = new Date(Date.now() - 30 * 60_000); // started 30 min ago
  const endsAt = new Date(Date.now() + 30 * 60_000); // ends in 30 min
  const classId = await createTestClass({ status: "IN_PROGRESS", startsAt, endsAt });
  await enrolSeededStudent(classId);

  try {
    await page.goto(`/classes/${classId}`);

    // The enrolled student is visible with action buttons next to them.
    await expect(page.getByRole("link", { name: /Ana Costa/ })).toBeVisible();
    const presenteButton = page.getByRole("button", { name: "Presente" });
    await expect(presenteButton).toBeVisible();

    await presenteButton.click();

    // Success toast confirms the mutation went through.
    await expect(page.getByText("Presença registada")).toBeVisible({ timeout: 10_000 });

    // After the cache invalidates, the markAttendance buttons disappear
    // (enrolment is no longer ENROLLED) and the displayed status badge
    // shows "Presente". Asserting the button is gone is the clearest
    // proof the state actually changed.
    await expect(presenteButton).not.toBeVisible({ timeout: 10_000 });
  } finally {
    await deleteTestClass(classId);
  }
});
