import { test, expect } from "@playwright/test";
import "dotenv/config";

/**
 * Multi-role auth coverage: instructors log in via the same form as
 * admins, land on the dashboard, but get a different layout
 * (`MobileLayout` instead of the admin sidebar) with a bottom-nav that
 * only exposes role-allowed tabs.
 *
 * Runs with a fresh storage state — does NOT reuse the admin session
 * baked by `auth.setup.ts`.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("instructor login redirects to dashboard with role-scoped nav", async ({ page }) => {
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error("SEED_PASSWORD env var required");

  await page.goto("/login");
  await page.locator("#email").fill("instrutor@demo.pt");
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Iniciar sessão" }).click();

  await page.waitForURL("/", { timeout: 15_000 });

  // Scope all nav-link assertions to the bottom-nav landmark so they
  // don't false-match dashboard cards that contain things like
  // "0/10 alunos" in their text.
  const nav = page.getByRole("navigation");

  // Instructor sees these tabs:
  await expect(nav.getByRole("link", { name: "Aulas" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Calendário" })).toBeVisible();

  // Staff-only tabs are not in the instructor's mobile nav:
  await expect(nav.getByRole("link", { name: "Alunos" })).not.toBeVisible();
  await expect(nav.getByRole("link", { name: "Instrutores" })).not.toBeVisible();
  await expect(nav.getByRole("link", { name: "Staff" })).not.toBeVisible();
  await expect(nav.getByRole("link", { name: "Estatísticas" })).not.toBeVisible();
});
