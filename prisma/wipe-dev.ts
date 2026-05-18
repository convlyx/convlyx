/**
 * Wipe dev database — DEVELOPMENT ONLY.
 *
 * Deletes every app row in FK-safe order and deletes the matching Supabase
 * auth.users (only those that appear in our User table — never touches
 * unrelated auth users). Intended to be run before `db:seed-demo` to get a
 * clean slate for screenshot/demo captures.
 *
 * Safety:
 *   - Refuses to run if DATABASE_URL points to the known production project
 *     ref (`idvupzweddgjcolgrluz`) — see CLAUDE.md for context.
 *   - Refuses to run unless WIPE_CONFIRM=yes is set, to prevent accidental
 *     invocation in CI or by tab-completion.
 *
 * Run with:  WIPE_CONFIRM=yes pnpm db:wipe-dev
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

const PROD_PROJECT_REF_GUARD = "idvupzweddgjcolgrluz";

function assertNotProd() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes(PROD_PROJECT_REF_GUARD)) {
    throw new Error(
      `Refusing to wipe: DATABASE_URL points to the production project ref (${PROD_PROJECT_REF_GUARD}). ` +
        `Check your .env file.`
    );
  }
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (supaUrl.includes(PROD_PROJECT_REF_GUARD)) {
    throw new Error(
      `Refusing to wipe: NEXT_PUBLIC_SUPABASE_URL points to the production project ref (${PROD_PROJECT_REF_GUARD}).`
    );
  }
}

function assertConfirmed() {
  if (process.env.WIPE_CONFIRM !== "yes") {
    throw new Error(
      "Refusing to wipe: set WIPE_CONFIRM=yes to confirm. This is intentionally noisy."
    );
  }
}

async function main() {
  assertNotProd();
  assertConfirmed();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Print connection info so the operator can sanity-check
  const dbHost = (process.env.DATABASE_URL ?? "").replace(/:[^:@]+@/, ":***@");
  console.log(`🗑️  Wiping dev DB at: ${dbHost}\n`);

  // 1. Snapshot all user IDs so we can clean up auth.users after the DB delete.
  const allUsers = await db.user.findMany({ select: { id: true, email: true } });
  console.log(`Found ${allUsers.length} users in DB.`);

  // 2. Delete app rows in FK-safe order.
  console.log("\nDeleting app rows…");
  const counts = {
    notification: (await db.notification.deleteMany({})).count,
    pushSubscription: (await db.pushSubscription.deleteMany({})).count,
    enrollment: (await db.enrollment.deleteMany({})).count,
    exam: (await db.exam.deleteMany({})).count,
    studentCourse: (await db.studentCourse.deleteMany({})).count,
    classSession: (await db.classSession.deleteMany({})).count,
    user: (await db.user.deleteMany({})).count,
    school: (await db.school.deleteMany({})).count,
    tenant: (await db.tenant.deleteMany({})).count,
  };
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(20)} ${n}`);
  }

  // 3. Delete matching Supabase auth.users (by id we already saw).
  console.log(`\nDeleting ${allUsers.length} Supabase auth users…`);
  let authDeleted = 0;
  for (const u of allUsers) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(u.id);
    if (error) {
      console.warn(`  ⚠️  Could not delete auth user ${u.email}: ${error.message}`);
    } else {
      authDeleted += 1;
    }
  }
  console.log(`  auth.users           ${authDeleted}`);

  console.log("\n✅ Wipe complete.");
  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
