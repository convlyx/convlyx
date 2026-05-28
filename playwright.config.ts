import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the Convlyx E2E suite.
 *
 * Runs against a local `pnpm dev` server (auto-started). Auth happens
 * once in the "setup" project, which logs in via the real UI as the
 * seeded `admin@demo.pt` and saves the resulting cookies to
 * `.auth/admin.json`. All test files then reuse that storage state and
 * skip the login form.
 *
 * Test data is created/cleaned-up per test via the Prisma client in
 * `e2e/fixtures/db.ts` — same pattern as the vitest tenant-isolation
 * tests, just driven through the UI instead of the tRPC caller.
 *
 * Local-only for now; CI integration is a separate concern (needs a
 * dedicated Supabase test project + workflow secrets).
 */

const STORAGE_STATE = ".auth/admin.json";

export default defineConfig({
  testDir: "./e2e",
  // Tests share the dev database — run serially so they don't race on
  // class IDs or enrolments. With random UUIDs they're already
  // collision-safe, but serial keeps debug output readable.
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    // Localhost bypasses the tenant-subdomain check in middleware
    // (see `extractSubdomain` in src/middleware.ts) — tenant scoping
    // then falls back to the logged-in user's own tenantId.
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    // Cold next dev can take a while to compile the first request.
    timeout: 120_000,
  },
});
