import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` is a Next.js build-time marker with no Node entry point;
      // stub it so server modules that import it (e.g. src/lib/novidades.ts)
      // can be pulled into the test graph via the router tree.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
  test: {
    // Integration tests hit a real Postgres; run sequentially to avoid
    // contention on shared rows. Local devs use the dev DB (DATABASE_URL
    // from .env); CI spins up a service-container Postgres.
    fileParallelism: false,
    testTimeout: 30_000,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
