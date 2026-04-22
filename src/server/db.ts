import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function createPrismaClient() {
  if (globalForPrisma.pool) {
    globalForPrisma.pool.end().catch(() => {});
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // single connection per serverless instance
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  globalForPrisma.pool = pool;
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
