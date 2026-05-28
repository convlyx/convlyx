import { test, expect } from "@playwright/test";
import { createTestClass, deleteTestClass } from "./fixtures/db";

/**
 * Staff path: cancel a scheduled class.
 *
 * The header shows a destructive "Cancelar aula" button while the class
 * is SCHEDULED or IN_PROGRESS. Clicking it opens a confirm dialog with
 * the default `Confirmar` / `Não` buttons.
 */
test("staff can cancel a scheduled class", async ({ page }) => {
  const classId = await createTestClass({ status: "SCHEDULED" });
  try {
    await page.goto(`/classes/${classId}`);

    await page.getByRole("button", { name: "Cancelar aula" }).click();

    // Scope the confirm click to the dialog so it doesn't match a stray
    // "Confirmar" elsewhere on the page.
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText("Aula cancelada")).toBeVisible({ timeout: 10_000 });

    // After the cache invalidates, the status badge in the header reads
    // "Cancelada" (was "Agendada"). The action buttons hide entirely
    // because `isActive` (SCHEDULED || IN_PROGRESS) is now false.
    await expect(page.getByText("Cancelada").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Cancelar aula" })).not.toBeVisible();
  } finally {
    await deleteTestClass(classId);
  }
});
