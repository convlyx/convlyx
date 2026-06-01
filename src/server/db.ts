import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// In serverless, each invocation might reuse the global scope.
// We cache the client and pool to reuse across warm invocations.
// On cold starts, a new pool + client is created.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Runtime connects via Supabase's transaction pooler (port 6543) on Vercel.
    // With Fluid Compute a single warm instance serves concurrent requests, so
    // max:1 would serialize their queries. Allow a few per instance — the
    // transaction pooler multiplexes them onto shared server connections safely.
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
}

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
}

export const db: PrismaClient = globalForPrisma.prisma;
