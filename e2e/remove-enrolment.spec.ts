import { test, expect } from "@playwright/test";
import { createTestClass, deleteTestClass, enrolSeededStudent } from "./fixtures/db";

/**
 * Staff path: remove an enrolled student from a scheduled class.
 *
 * Different effect from cancelling the class entirely — here only the
 * enrolment is removed (the underlying mutation hard-deletes the row),
 * the class itself stays SCHEDULED. The enrolment list collapses to
 * the empty state.
 */
test("staff can remove an enrolled student from a scheduled class", async ({ page }) => {
  const classId = await createTestClass({ status: "SCHEDULED" });
  await enrolSeededStudent(classId);

  try {
    await page.goto(`/classes/${classId}`);

    // Verify the student is enrolled (precondition)
    await expect(page.getByRole("link", { name: /Ana Costa/ })).toBeVisible();

    // Click the destructive "Remover" button next to the student
    await page.getByRole("button", { name: "Remover" }).click();

    // Confirm in the dialog
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText("Inscrição removida")).toBeVisible({ timeout: 10_000 });

    // enrollment.cancel deletes the row outright (not soft-cancel), so
    // the student link disappears and the empty state takes over.
    await expect(page.getByRole("link", { name: /Ana Costa/ })).not.toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Sem alunos inscritos")).toBeVisible();
  } finally {
    await deleteTestClass(classId);
  }
});
