import { test, expect } from "@playwright/test";
import { createTestClass, deleteTestClass } from "./fixtures/db";

/**
 * Staff path: enrol a student into a scheduled class.
 *
 * Setup: ephemeral SCHEDULED class created via Prisma. The seeded
 * student (`aluno@demo.pt`, "Ana Costa") is available in the picker
 * because they're not yet enrolled in this class.
 */
test("staff can enrol a student in a class", async ({ page }) => {
  const classId = await createTestClass();
  try {
    await page.goto(`/classes/${classId}`);

    // Open the student picker
    await page.getByRole("button", { name: "Adicionar aluno" }).click();

    // Pick the seeded student by typing into the search input
    const search = page.getByPlaceholder("Pesquisar aluno...");
    await search.fill("Ana");
    // Click the row in the dropdown — its accessible name is the student's name
    await page.getByRole("button", { name: /Ana Costa/ }).first().click();

    // Dismiss the picker dropdown — it's absolutely positioned (z-50) and
    // overlays the "Inscrever" submit button below. The picker closes
    // 150ms after the search input blurs.
    await search.evaluate((el: HTMLInputElement) => el.blur());
    await page.waitForTimeout(200);

    // Submit the enrolment. Button label is `Inscrever 1 aluno`.
    await page.getByRole("button", { name: /Inscrever 1 aluno/ }).click();

    // The student row should now appear in the enrolled list. The picker
    // also gets hidden after success.
    await expect(page.getByRole("link", { name: /Ana Costa/ })).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await deleteTestClass(classId);
  }
});
