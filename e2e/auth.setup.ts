import { test as setup, expect } from "@playwright/test";
import "dotenv/config";

const STORAGE_STATE = ".auth/admin.json";

/**
 * One-time login as the seeded admin. Saves the resulting cookies to
 * `.auth/admin.json` so every other test starts already authenticated —
 * we don't want to pay the login flow on every test.
 *
 * Also acts as the login regression test: if Supabase auth, the form, or
 * the post-login redirect breaks, this fails and blocks everything else.
 *
 * Reads the admin password from `SEED_PASSWORD` (same env var the seed
 * script uses, so dev environments already have it set).
 */
setup("authenticate as seeded admin", async ({ page }) => {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error(
      "SEED_PASSWORD env var is required to run the E2E suite. Set it in .env.local — same value the seed script uses.",
    );
  }

  await page.goto("/login");
  await page.locator("#email").fill("admin@demo.pt");
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Iniciar sessão" }).click();

  // Wait for the post-login navigation to land on the dashboard. The
  // form uses a hard `window.location.href` redirect after a 300ms
  // cookie-commit delay, so we wait for the URL change explicitly.
  await page.waitForURL("/", { timeout: 15_000 });
  // Sanity check we're actually in: the dashboard renders a back-link
  // that doesn't exist on the login page.
  await expect(page).toHaveURL("/");

  await page.context().storageState({ path: STORAGE_STATE });
});
