/**
 * Break-glass tool for the user lifecycle when the normal app flow can't
 * deliver email — iCloud rejections, SMTP misconfig, rate limiting, etc.
 * Each mode uses Supabase's `generateLink` admin API to obtain a one-time
 * URL **without sending any email**, so it works regardless of recipient
 * deliverability. You then hand the URL to the user via WhatsApp / SMS.
 *
 * Modes:
 *   (default) — create a new user. Mirrors the `user.create` tRPC flow:
 *     creates the Supabase auth row, inserts the Prisma `User` (+ optional
 *     initial `StudentCourse` for STUDENT), and prints the activation link.
 *
 *   --reset  — generate a password-reset link for an existing user. Use
 *     when an @icloud.com (or otherwise undeliverable) user forgets their
 *     password and the in-app "forgot password" email won't reach them.
 *
 * Usage — create:
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
 * Usage — reset:
 *   pnpm dotenv -e .env.prod -- tsx scripts/admin-create-user.ts \
 *     --reset --email=foo@bar.com
 *
 *   The school subdomain is derived from the user's Prisma row, so no
 *   --school flag is needed.
 *
 * Run against the local DB by swapping `.env.prod` for `.env`.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LICENSE_CATEGORIES, type LicenseCategory } from "../src/lib/license-categories";

type Role = "ADMIN" | "SECRETARY" | "INSTRUCTOR" | "STUDENT";
const ROLES: Role[] = ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"];

type ParsedArgs = { flags: Set<string>; values: Record<string, string> };

function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (const a of argv.slice(2)) {
    const kv = a.match(/^--([^=]+)=(.*)$/);
    if (kv) {
      values[kv[1]] = kv[2];
      continue;
    }
    const flag = a.match(/^--([^=]+)$/);
    if (flag) flags.add(flag[1]);
  }
  return { flags, values };
}

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function isLicenseCategory(v: string): v is LicenseCategory {
  return (LICENSE_CATEGORIES as readonly string[]).includes(v);
}

function buildRedirectTo(siteUrl: string, subdomain: string): string {
  const parsed = new URL(siteUrl);
  return `${parsed.protocol}//${subdomain}.${parsed.host}/update-password`;
}

async function runCreate(
  args: ParsedArgs,
  db: PrismaClient,
  supabaseAdmin: SupabaseClient,
  siteUrl: string,
) {
  const email = args.values.email?.trim().toLowerCase();
  const name = args.values.name?.trim();
  const phone = args.values.phone?.trim() || null;
  const role = args.values.role?.trim().toUpperCase() as Role | undefined;
  const subdomain = args.values.school?.trim().toLowerCase();
  const category = args.values.category?.trim().toUpperCase();
  const qualifiedRaw = args.values.qualified?.trim();

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

  // Resolve tenant + school from subdomain.
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

  const existing = await db.membership.findFirst({
    where: { tenantId: school.tenantId, user: { email } },
    select: { userId: true, status: true, role: true },
  });
  if (existing) {
    die(
      `User ${email} already a member of this school (id=${existing.userId}, role=${existing.role}, status=${existing.status}). ` +
        `Use --reset to send a new password link, or reactivate via the dashboard.`,
    );
  }

  const redirectTo = buildRedirectTo(siteUrl, school.subdomain);

  // Generate invite link — creates auth user AND returns the URL,
  // no email is sent. If the auth row already exists from a prior
  // failed attempt, fall back to recovery.
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

  console.log(`→ inserting Prisma rows…`);
  await db.$transaction(async (tx) => {
    // Upsert the global User (the auth user may already exist from another
    // school); the per-tenant Membership below is what makes them a member here.
    await tx.user.upsert({
      where: { id: authUserId! },
      create: { id: authUserId!, email, name, phone },
      update: {},
    });

    // Per-tenant Membership (Approach 1a): role/school live here, and
    // `protectedProcedure` REQUIRES one — without it the user authenticates
    // but is rejected from every procedure. Mirror the tRPC create path.
    await tx.membership.create({
      data: {
        tenantId: school.tenantId,
        userId: authUserId!,
        name,
        phone,
        schoolId: school.id,
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
}

async function runReset(
  args: ParsedArgs,
  db: PrismaClient,
  supabaseAdmin: SupabaseClient,
  siteUrl: string,
) {
  const email = args.values.email?.trim().toLowerCase();
  if (!email) die("Missing --email");

  // Email is globally unique now (one User), but a person can belong to
  // several schools. The recovery link redirects to one subdomain, so guard
  // against ambiguity rather than silently picking one.
  const user = await db.user.findFirst({
    where: { email },
    select: {
      id: true,
      name: true,
      memberships: { select: { school: { select: { subdomain: true, name: true } } } },
    },
  });
  if (!user) {
    die(
      `No user found with email ${email}. If they exist in Supabase auth but not in our DB, ` +
        `create them via the default (no-flag) mode instead.`,
    );
  }
  if (user.memberships.length === 0) {
    die(`User ${email} has no school membership. Create them via the default (no-flag) mode.`);
  }
  if (user.memberships.length > 1) {
    const list = user.memberships.map((m) => `${m.school.subdomain} (${m.school.name})`).join(", ");
    die(
      `Email ${email} belongs to multiple schools: ${list}. ` +
        `Reset via the dashboard for the correct one, or extend this script with --school to disambiguate.`,
    );
  }
  const school = user.memberships[0].school;

  const redirectTo = buildRedirectTo(siteUrl, school.subdomain);

  console.log(`→ generating recovery link for ${email}…`);
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

  const actionLink = recovery.data.properties?.action_link;
  if (!actionLink) die("Could not determine the action link");

  console.log("\n✔ Recovery link generated.");
  console.log(`  id:     ${user.id}`);
  console.log(`  email:  ${email}`);
  console.log(`  name:   ${user.name}`);
  console.log(`  school: ${school.name} (${school.subdomain})`);
  console.log("\n🔑 Send this link to the user (it lets them set a new password):\n");
  console.log(`   ${actionLink}\n`);
  console.log("Note: the link is single-use and expires per your Supabase auth settings.\n");
}

async function main() {
  const args = parseArgs(process.argv);

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
    if (args.flags.has("reset")) {
      await runReset(args, db, supabaseAdmin, siteUrl);
    } else {
      await runCreate(args, db, supabaseAdmin, siteUrl);
    }
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
