/**
 * One-shot setup of a trial school: test logins + example people + example
 * classes, so a prospect opens a "furnished" space instead of an empty one.
 *
 * What it does (idempotent — safe to re-run; existing rows are skipped):
 *   1. Verifies --school-id / --tenant-id / --subdomain all match one school,
 *      and trims stray whitespace from the school name.
 *   2. Optionally sets the password of the school's (single) ADMIN — the one
 *      created via admin.convlyx.com — with --admin-password.
 *   3. Creates the test logins (Instrutor Teste, Aluno Teste) with the given
 *      passwords, plus example instructors/students "(exemplo)" with random
 *      passwords nobody uses. All via `auth.admin.createUser` with
 *      `email_confirm: true` → **no email is ever sent**. Addresses live on
 *      `<sub>.convlyx.com`, which has no mailbox.
 *   4. Generates ~7 weeks of classes + enrolments around today by running
 *      STEP 1 of scripts/demo-classes.sql with this school's ids. Skipped if
 *      the school already has classes (use --force-classes to add anyway).
 *   5. Thins practicals to at most --practicals-per-week (default 2) per
 *      example/test student per week, so profiles look like a real school.
 *      Only touches people with an @<subdomain>.convlyx.com email.
 *
 * Connects via DIRECT_URL (session pooler, 5432) — never the 6543 pooler,
 * which from a local machine can land on the stale "ghost" instance
 * (see CLAUDE.md → PROD DB ROUTING).
 *
 * Usage (PowerShell, repo root). Use tsx's --env-file, NOT `pnpm dotenv -e … --`:
 * pnpm swallows the first `--`, so dotenv-cli eats every --flag and the
 * script receives no arguments.
 *   pnpm tsx --env-file=.env.prod scripts/setup-trial-school.ts `
 *     --subdomain=escolaac `
 *     --school-id=<uuid> --tenant-id=<uuid> `
 *     --categories=B,A `
 *     --admin-password="..." --instructor-password="..." --student-password="..."
 *
 * Cleanup later: every example/test person has an email ending in
 * "@<subdomain>.convlyx.com", which is how a cleanup script finds them.
 */

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LICENSE_CATEGORIES, type LicenseCategory } from "../src/lib/license-categories";

// The demo SQL is written against this school; we swap in the target ids.
const DEMO_TENANT_ID = "576604ff-56c9-45d5-aebd-3d9e2a28b760";
const DEMO_SCHOOL_ID = "2dcc5c3c-86e6-4512-a7c5-20b6da377efa";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Role = "INSTRUCTOR" | "STUDENT";
type Person = {
  local: string; // email local part
  name: string;
  role: Role;
  categories: LicenseCategory[]; // instructor: qualified; student: [course category]
  password: string;
  login: boolean; // credentials handed to the school
};

function parseArgs(argv: string[]) {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (const a of argv.slice(2)) {
    const kv = a.match(/^--([^=]+)=(.*)$/);
    if (kv) values[kv[1]] = kv[2];
    else if (a.startsWith("--")) flags.add(a.slice(2));
  }
  return { values, flags };
}

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function randomPassword(): string {
  return randomBytes(18).toString("base64url");
}

function isLicenseCategory(v: string): v is LicenseCategory {
  return (LICENSE_CATEGORIES as readonly string[]).includes(v);
}

function buildPeople(cats: LicenseCategory[], instructorPw: string, studentPw: string): Person[] {
  const main = cats[0];
  const second = cats[1] ?? main;
  const rnd = randomPassword;
  return [
    { local: "instrutor", name: "Instrutor Teste", role: "INSTRUCTOR", categories: cats, password: instructorPw, login: true },
    { local: "aluno", name: "Aluno Teste", role: "STUDENT", categories: [main], password: studentPw, login: true },
    { local: "carlos.mendes", name: "Carlos Mendes (exemplo)", role: "INSTRUCTOR", categories: cats, password: rnd(), login: false },
    { local: "ana.costa", name: "Ana Costa (exemplo)", role: "STUDENT", categories: [main], password: rnd(), login: false },
    { local: "bruno.pinto", name: "Bruno Pinto (exemplo)", role: "STUDENT", categories: [main], password: rnd(), login: false },
    { local: "ines.martins", name: "Inês Martins (exemplo)", role: "STUDENT", categories: [main], password: rnd(), login: false },
    { local: "rui.ferreira", name: "Rui Ferreira (exemplo)", role: "STUDENT", categories: [main], password: rnd(), login: false },
    { local: "marta.sousa", name: "Marta Sousa (exemplo)", role: "STUDENT", categories: [second], password: rnd(), login: false },
    { local: "tiago.lopes", name: "Tiago Lopes (exemplo)", role: "STUDENT", categories: [second], password: rnd(), login: false },
  ];
}

async function ensurePerson(
  p: Person,
  email: string,
  school: { id: string; tenantId: string },
  db: PrismaClient,
  supabaseAdmin: SupabaseClient,
): Promise<"created" | "skipped"> {
  const existing = await db.membership.findFirst({
    where: { tenantId: school.tenantId, user: { email } },
    select: { id: true },
  });
  if (existing) return "skipped";

  // Global identity may already exist (e.g. a previous partial run).
  let userId = (await db.user.findFirst({ where: { email }, select: { id: true } }))?.id ?? null;

  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: p.password,
      email_confirm: true, // no confirmation / invite email
    });
    if (error || !data.user) die(`Supabase createUser failed for ${email}: ${error?.message ?? "no user"}`);
    userId = data.user.id;
  } else if (p.login) {
    // Make sure the handed-out password is the one that works.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: p.password });
    if (error) die(`Could not set password for ${email}: ${error.message}`);
  }

  const id = userId;
  try {
    await db.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id },
        create: { id, email, name: p.name },
        update: {},
      });
      // protectedProcedure REQUIRES a Membership — every creation path writes one.
      await tx.membership.create({
        data: {
          tenantId: school.tenantId,
          userId: id,
          name: p.name,
          schoolId: school.id,
          role: p.role,
          qualifiedCategories: p.role === "INSTRUCTOR" ? p.categories : [],
        },
      });
      if (p.role === "STUDENT") {
        await tx.studentCourse.create({
          data: {
            tenantId: school.tenantId,
            schoolId: school.id,
            studentId: id,
            category: p.categories[0],
          },
        });
      }
    });
  } catch (e) {
    console.error(`  ! DB insert failed for ${email}; the auth user ${id} remains and a re-run will reuse it.`);
    throw e;
  }
  return "created";
}

async function main() {
  const { values, flags } = parseArgs(process.argv);

  const subdomain = values.subdomain?.trim().toLowerCase();
  const schoolId = values["school-id"]?.trim();
  const tenantId = values["tenant-id"]?.trim();
  const adminPassword = values["admin-password"];
  const instructorPassword = values["instructor-password"];
  const studentPassword = values["student-password"];
  // Split on commas OR whitespace: PowerShell turns an unquoted `B,A` into an
  // array and passes it as "B A".
  const catsRaw = (values.categories ?? "B").split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);

  if (!subdomain) die("Missing --subdomain");
  if (!schoolId || !UUID_RE.test(schoolId)) die("Missing or invalid --school-id");
  if (!tenantId || !UUID_RE.test(tenantId)) die("Missing or invalid --tenant-id");
  if (!instructorPassword || instructorPassword.length < 8) die("--instructor-password (min 8 chars) is required");
  if (!studentPassword || studentPassword.length < 8) die("--student-password (min 8 chars) is required");
  if (adminPassword !== undefined && adminPassword.length < 8) die("--admin-password must be at least 8 chars");
  const practicalsPerWeek = Number(values["practicals-per-week"] ?? 2);
  if (!Number.isInteger(practicalsPerWeek) || practicalsPerWeek < 1) die("--practicals-per-week must be a positive integer");
  const categories: LicenseCategory[] = [];
  for (const c of catsRaw) {
    if (!isLicenseCategory(c)) die(`Invalid category "${c}". Valid: ${LICENSE_CATEGORIES.join(", ")}`);
    categories.push(c);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const directUrl = process.env.DIRECT_URL;
  if (!supabaseUrl || !serviceRoleKey) die("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  if (!directUrl) die("DIRECT_URL must be set (session pooler, port 5432)");
  if (directUrl.includes(":6543")) die("DIRECT_URL points at the 6543 pooler — it must be the 5432 session pooler");

  const pool = new Pool({ connectionString: directUrl });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // ── 1. Verify the school ────────────────────────────────────────────────
    const school = await db.school.findFirst({
      where: { id: schoolId, tenantId },
      select: { id: true, tenantId: true, name: true, subdomain: true },
    });
    if (!school) die("No school with that --school-id + --tenant-id pair");
    if (school.subdomain !== subdomain) {
      die(`Subdomain mismatch: the school's subdomain is "${school.subdomain}", not "${subdomain}"`);
    }
    console.log(`\n▶ ${school.name.trim()} (${school.subdomain}.convlyx.com)`);

    const trimmed = school.name.trim();
    if (trimmed !== school.name) {
      await db.school.update({ where: { id: school.id }, data: { name: trimmed } });
      console.log(`  ✔ school name trimmed: "${school.name}" → "${trimmed}"`);
    }
    const tenant = await db.tenant.findFirst({ where: { id: tenantId }, select: { name: true } });
    if (tenant && tenant.name !== tenant.name.trim()) {
      await db.tenant.update({ where: { id: tenantId }, data: { name: tenant.name.trim() } });
      console.log(`  ✔ tenant name trimmed`);
    }

    // ── 2. Admin password ───────────────────────────────────────────────────
    const admins = await db.membership.findMany({
      where: { tenantId, schoolId: school.id, role: "ADMIN", status: "ACTIVE" },
      select: { userId: true, user: { select: { email: true } } },
    });
    if (admins.length === 0) die("The school has no ACTIVE ADMIN — create it in admin.convlyx.com first");
    let adminEmail = admins.map((a) => a.user.email).join(", ");
    if (adminPassword !== undefined) {
      if (admins.length > 1) die(`More than one ADMIN (${adminEmail}) — set the password manually`);
      const { error } = await supabaseAdmin.auth.admin.updateUserById(admins[0].userId, { password: adminPassword });
      if (error) die(`Could not set the admin password: ${error.message}`);
      adminEmail = admins[0].user.email;
      console.log(`  ✔ admin password set (${adminEmail})`);
    }

    // ── 3. People ───────────────────────────────────────────────────────────
    const people = buildPeople(categories, instructorPassword, studentPassword);
    for (const p of people) {
      const email = `${p.local}@${subdomain}.convlyx.com`;
      const result = await ensurePerson(p, email, school, db, supabaseAdmin);
      console.log(`  ${result === "created" ? "✔" : "·"} ${p.name.padEnd(26)} ${p.role.padEnd(10)} ${p.categories.join(",")}  ${result}`);
    }

    // ── 4. Classes ──────────────────────────────────────────────────────────
    const existingClasses = await db.classSession.count({ where: { tenantId, schoolId: school.id } });
    if (existingClasses > 0 && !flags.has("force-classes")) {
      console.log(`  · classes: ${existingClasses} already exist — skipped (use --force-classes to add more)`);
    } else {
      const sqlFile = readFileSync(join(__dirname, "demo-classes.sql"), "utf8");
      const start = sqlFile.indexOf("-- ═══ STEP 1");
      const end = sqlFile.indexOf("-- ═══ STEP 2");
      if (start < 0 || end < 0) die("Could not find STEP 1 / STEP 2 markers in scripts/demo-classes.sql");
      const step1 = sqlFile
        .slice(start, end)
        .replaceAll(DEMO_TENANT_ID, tenantId)
        .replaceAll(DEMO_SCHOOL_ID, school.id);
      const client = await pool.connect();
      try {
        await client.query(step1);
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
      console.log("  ✔ classes generated");
    }

    // ── 4b. Thin practicals to a believable density ─────────────────────────
    // The generator fills up to 3 concurrent practical slots, 4× a day, which
    // for a handful of example students means ~6 practicals/student/week (a
    // real student does ~32 over several months). Keep at most N per student
    // per week, picked pseudo-randomly (md5 of the id) so they spread across
    // the week. Scoped to example/test people (email @<sub>.convlyx.com) only,
    // so re-running after the school adds real data never touches it.
    const domain = `%@${subdomain}.convlyx.com`;
    const removed = await db.$transaction(async (tx) => {
      const enrolDeleted = await tx.$executeRaw`
        DELETE FROM enrollments e
        USING (
          SELECT e2.id,
                 row_number() OVER (
                   PARTITION BY e2.student_id, date_trunc('week', cs.starts_at)
                   ORDER BY md5(cs.id::text)
                 ) AS rn
          FROM enrollments e2
          JOIN class_sessions cs ON cs.id = e2.session_id
          JOIN users u ON u.id = e2.student_id
          WHERE cs.tenant_id = ${tenantId}::uuid
            AND cs.school_id = ${school.id}::uuid
            AND cs.class_type = 'PRACTICAL'
            AND u.email LIKE ${domain}
        ) ranked
        WHERE e.id = ranked.id AND ranked.rn > ${practicalsPerWeek}`;
      // Practicals left with no student (thinned above, or generated as
      // cancelled) — only those taught by example/test instructors.
      const sessionsDeleted = await tx.$executeRaw`
        DELETE FROM class_sessions cs
        USING users u
        WHERE u.id = cs.instructor_id
          AND u.email LIKE ${domain}
          AND cs.tenant_id = ${tenantId}::uuid
          AND cs.school_id = ${school.id}::uuid
          AND cs.class_type = 'PRACTICAL'
          AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.session_id = cs.id)`;
      return { enrolDeleted, sessionsDeleted };
    });
    if (removed.sessionsDeleted > 0) {
      console.log(`  ✔ practicals thinned to ≤${practicalsPerWeek}/student/week (−${removed.sessionsDeleted} aulas, −${removed.enrolDeleted} inscrições)`);
    } else {
      console.log(`  · practicals already ≤${practicalsPerWeek}/student/week`);
    }

    // ── 5. Verify ───────────────────────────────────────────────────────────
    const now = new Date();
    const [theory, practical, upcoming, enrollments] = await Promise.all([
      db.classSession.count({ where: { tenantId, schoolId: school.id, classType: "THEORY" } }),
      db.classSession.count({ where: { tenantId, schoolId: school.id, classType: "PRACTICAL" } }),
      db.classSession.count({ where: { tenantId, schoolId: school.id, startsAt: { gt: now } } }),
      db.enrollment.count({ where: { tenantId, schoolId: school.id } }),
    ]);
    console.log(`  → ${theory} teóricas, ${practical} práticas (${upcoming} futuras), ${enrollments} inscrições`);

    // ── Summary to hand over ────────────────────────────────────────────────
    const login = people.filter((p) => p.login);
    console.log("\n──────── Acessos para enviar à escola ────────");
    console.log(`Endereço: https://${subdomain}.convlyx.com`);
    console.log(`Secretaria: ${adminEmail}${adminPassword ? `  /  ${adminPassword}` : "  (palavra-passe já definida)"}`);
    for (const p of login) {
      console.log(`${p.role === "INSTRUCTOR" ? "Instrutor" : "Aluno"}: ${p.local}@${subdomain}.convlyx.com  /  ${p.password}`);
    }
    console.log("──────────────────────────────────────────────\n");
  } finally {
    await db.$disconnect();
    await pool.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
