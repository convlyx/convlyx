import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrations: {
    path: path.join(__dirname, "prisma", "migrations"),
  },
  datasource: {
    // Migrations must use a session/direct connection (DIRECT_URL, port 5432) —
    // the transaction pooler (6543) the app runs on at runtime can't execute
    // migrations. Fall back to DATABASE_URL so CI (plain Postgres, no pooler)
    // and any env without DIRECT_URL still work.
    // IMPORTANT: whenever DATABASE_URL points at the 6543 pooler, DIRECT_URL
    // must be set to the 5432 connection, or migrations will hit the pooler.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
