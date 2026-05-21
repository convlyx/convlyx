/**
 * Break-glass tool for creating a user when the normal app flow can't —
 * e.g. when Supabase's transactional email is failing for a specific
 * recipient (iCloud rejections, SMTP misconfig, rate limiting).
 *
 * What it does:
 *   1. Creates the Supabase auth user via `generateLink({ type: "invite" })`
 *      — same as the app's invite path, but **without** sending an email.
 *      The action_link is returned to stdout so it can be hand-delivered
 *      via WhatsApp / SMS / phone.
 *   2. If the auth user already exists (a previous failed attempt may
 *      have created it), falls back to `type: "recovery"` so the recipient
 *      still gets a "set password" link.
 *   3. Inserts the Prisma `User` row + optional initial `StudentCourse`
 *      in a transaction — same shape as `user.create` in user.ts.
 *
 * Usage:
 *   pnpm dotenv -e .env.prod -- tsx scripts/admin-create-user.ts \
 *     --school=schoolsubdomain \
 *     --email=foo@bar.com \
 *     --name="Foo Bar" \
 *     --role=STUDENT \
 *     --category=B \
 *     [--phone="+351912345678"]
 *
 *   For instructors, pass --qualified=B,C instead of --category:
 *   pnpm dotenv -e .env.prod -- tsx scripts/admin-create-user.ts \
 *     --school=acme --email=i@a.com --name="Inst" --role=INSTRUCTOR \
 *     --qualified=B,C1
 *
 * Run against the local DB by swapping `.env.prod` for `.env`.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { LICENSE_CATEGORIES, type LicenseCategory } from "../src/lib/license-categories";

type Role = "ADMIN" | "SECRETARY" | "INSTRUCTOR" | "STUDENT";
const ROLES: Role[] = ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"];

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2];
  }
  return out;
}

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function isLicenseCategory(v: string): v is LicenseCategory {
  return (LICENSE_CATEGORIES as readonly string[]).includes(v);
}

async function main() {
  const args = parseArgs(process.argv);

  const email = args.email?.trim().toLowerCase();
  const name = args.name?.trim();
  const phone = args.phone?.trim() || null;
  const role = args.role?.trim().toUpperCase() as Role | undefined;
  const subdomain = args.school?.trim().toLowerCase();
  const category = args.category?.trim().toUpperCase();
  const qualifiedRaw = args.qualified?.trim();

  if (!email) die("Missing --email");
  if (!name) die("Missing --name");
  if (!role || !ROLES.includes(role)) die(`Missing or invalid --role (one of ${ROLES.join(", ")})`);
  if (!subdomain) die("Missing --school (school subdomain)");

  let initialCategory: LicenseCategory | null = null;
  if (role === "STUDENT") {
    if (!category) die("--category is required for STUDENT (e.g. --category=B)");
    if (!isLicenseCategory(category)) die(`Invalid category "${category}". Valid: ${LICENSE_CATEGORIES.join(", ")}`);
    initialCategory = category;
  }

  const qualifiedCategories: LicenseCategory[] = [];
  if (role === "INSTRUCTOR" && qualifiedRaw) {
    const parts = qualifiedRaw.split(",").map((s) => s.trim().toUpperCase());
    for (const p of parts) {
      if (!isLicenseCategory(p)) die(`Invalid qualified category "${p}". Valid: ${LICENSE_CATEGORIES.join(", ")}`);
      qualifiedCategories.push(p);
    }
  }

  // Required env vars (same set the app needs)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!supabaseUrl || !serviceRoleKey) die("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  if (!databaseUrl) die("DATABASE_URL must be set");

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Resolve tenant + school from subdomain.
    // NOTE: `subdomain` has no DB-level unique constraint, so this is a
    // `findFirst`. Works today because every tenant has exactly one school;
    // if/when tenants get multiple schools or subdomains stop being globally
    // unique, switch this to take an explicit --school-id flag (or add a
    // unique constraint on School.subdomain) to avoid silently picking the
    // wrong school.
    const school = await db.school.findFirst({
      where: { subdomain },
      select: { id: true, tenantId: true, name: true, subdomain: true },
    });
    if (!school) die(`No school found with subdomain "${subdomain}"`);

    // 2. Guard against duplicate Prisma row in the same tenant
    const existing = await db.user.findFirst({
      where: { tenantId: school.tenantId, email },
      select: { id: true, status: true, role: true },
    });
    if (existing) {
      die(
        `User ${email} already exists in tenant (id=${existing.id}, role=${existing.role}, status=${existing.status}). ` +
          `Delete or reactivate via the dashboard instead of re-creating.`,
      );
    }

    // 3. Build invite URL pointing at the school subdomain (mirrors user.create)
    const siteUrlParsed = new URL(siteUrl);
    const tenantHost = `${school.subdomain}.${siteUrlParsed.host}`;
    const redirectTo = `${siteUrlParsed.protocol}//${tenantHost}/update-password`;

    // 4. Generate invite link — creates auth user AND returns the URL,
    //    no email is sent. If the auth row already exists from a prior
    //    failed attempt, fall back to recovery.
    console.log(`→ generating invite link for ${email}…`);
    let actionLink: string | null = null;
    let authUserId: string | null = null;

    const invite = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    if (invite.error) {
      const msg = invite.error.message?.toLowerCase() ?? "";
      const alreadyExists =
        msg.includes("already been registered") || msg.includes("already exists") || msg.includes("already registered");
      if (!alreadyExists) {
        die(
          `Supabase generateLink(invite) failed: ${invite.error.message} ` +
            `(status=${invite.error.status}, code=${invite.error.code})`,
        );
      }
      console.log(`  auth user already exists for ${email} — falling back to recovery link`);
      const recovery = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (recovery.error || !recovery.data?.user) {
        die(
          `Supabase generateLink(recovery) failed: ${recovery.error?.message ?? "no user returned"} ` +
            `(status=${recovery.error?.status}, code=${recovery.error?.code})`,
        );
      }
      actionLink = recovery.data.properties?.action_link ?? null;
      authUserId = recovery.data.user.id;
    } else {
      if (!invite.data?.user) die("Supabase generateLink returned no user");
      actionLink = invite.data.properties?.action_link ?? null;
      authUserId = invite.data.user.id;
    }

    if (!authUserId) die("Could not determine the auth user id");
    if (!actionLink) die("Could not determine the action link");

    // 5. Insert the Prisma User row + optional StudentCourse atomically
    console.log(`→ inserting Prisma rows…`);
    await db.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: authUserId!,
          tenantId: school.tenantId,
          schoolId: school.id,
          email,
          name,
          phone,
          role,
          qualifiedCategories: role === "INSTRUCTOR" ? qualifiedCategories : [],
        },
      });

      if (role === "STUDENT" && initialCategory) {
        await tx.studentCourse.create({
          data: {
            tenantId: school.tenantId,
            schoolId: school.id,
            studentId: authUserId!,
            category: initialCategory,
          },
        });
      }
    });

    console.log("\n✔ User created.");
    console.log(`  id:     ${authUserId}`);
    console.log(`  email:  ${email}`);
    console.log(`  role:   ${role}`);
    console.log(`  school: ${school.name} (${school.subdomain})`);
    if (initialCategory) console.log(`  course: ${initialCategory}`);
    if (qualifiedCategories.length) console.log(`  qualified: ${qualifiedCategories.join(", ")}`);

    console.log("\n📨 Send this link to the user (it sets their password and logs them in):\n");
    console.log(`   ${actionLink}\n`);
    console.log("Note: the link is single-use and expires per your Supabase auth settings.\n");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
