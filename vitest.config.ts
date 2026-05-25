import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Integration tests hit a real Postgres; run sequentially to avoid
    // contention on shared rows. Local devs use the dev DB (DATABASE_URL
    // from .env); CI spins up a service-container Postgres.
    fileParallelism: false,
    testTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
