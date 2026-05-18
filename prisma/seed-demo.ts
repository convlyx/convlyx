/**
 * Demo seed — populates the dev DB with 6 months of realistic Portuguese
 * driving school data, designed to produce clean screenshots for the landing
 * page (and to give analytics dashboards real trends to render).
 *
 * Run with:  pnpm db:seed-demo  (against .env, dev DB)
 *
 * For best results, run `pnpm db:wipe-dev` first so this seeds onto a clean
 * slate. The script is idempotent (uses upserts where possible) but the
 * historical class generation is non-deterministic, so rerunning without a
 * wipe will accumulate duplicates.
 *
 * What gets seeded:
 *   - 1 Tenant, 1 School
 *   - 1 Admin, 1 Secretary, 4 Instructors (with qualified categories), 25 Students
 *   - 1 StudentCourse per student (mostly category B, some A/BE/C, mixed status)
 *   - ~6 months of past ClassSessions + this week + ~3 weeks ahead
 *   - Enrollments with realistic attendance distribution
 *   - Theory + Practical Exams (mix of PASSED/FAILED/NO_SHOW/SCHEDULED)
 *   - A small spread of Notifications
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SEED_PASSWORD = process.env.SEED_PASSWORD;
if (!SEED_PASSWORD) {
  throw new Error("SEED_PASSWORD env var is required (set it in .env or the shell before seeding).");
}

// ─── People ────────────────────────────────────────────────────────────────

const STAFF = [
  { name: "Sofia Pereira", email: "admin@demo.pt", role: "ADMIN" as const, phone: "+351 912 100 200" },
  { name: "Maria Silva", email: "secretaria@demo.pt", role: "SECRETARY" as const, phone: "+351 912 300 400" },
];

const INSTRUCTORS = [
  { name: "João Santos", email: "instrutor@demo.pt", phone: "+351 933 100 200", categories: ["B"] as const },
  { name: "Fernando Mendes", email: "fernando.mendes@demo.pt", phone: "+351 933 200 300", categories: ["B", "BE"] as const },
  { name: "Paula Teixeira", email: "paula.teixeira@demo.pt", phone: "+351 933 300 400", categories: ["B", "A"] as const },
  { name: "Ricardo Lopes", email: "ricardo.lopes@demo.pt", phone: "+351 933 400 500", categories: ["B", "C", "C1"] as const },
];

const STUDENTS = [
  // Note: aluno@demo.pt is the canonical demo student login (kept from prior seed).
  { name: "Ana Costa", email: "aluno@demo.pt", category: "B" as const },
  { name: "Carlos Santos", email: "carlos.santos@demo.pt", category: "B" as const },
  { name: "Maria Oliveira", email: "maria.oliveira@demo.pt", category: "B" as const },
  { name: "Pedro Ferreira", email: "pedro.ferreira@demo.pt", category: "B" as const },
  { name: "Sofia Rodrigues", email: "sofia.rodrigues@demo.pt", category: "B" as const },
  { name: "Tiago Almeida", email: "tiago.almeida@demo.pt", category: "B" as const },
  { name: "Beatriz Silva", email: "beatriz.silva@demo.pt", category: "B" as const },
  { name: "Diogo Pereira", email: "diogo.pereira@demo.pt", category: "B" as const },
  { name: "Inês Martins", email: "ines.martins@demo.pt", category: "B" as const },
  { name: "Rafael Sousa", email: "rafael.sousa@demo.pt", category: "B" as const },
  { name: "Catarina Lopes", email: "catarina.lopes@demo.pt", category: "B" as const },
  { name: "Miguel Fernandes", email: "miguel.fernandes@demo.pt", category: "A" as const },
  { name: "Leonor Gonçalves", email: "leonor.goncalves@demo.pt", category: "B" as const },
  { name: "Gonçalo Ribeiro", email: "goncalo.ribeiro@demo.pt", category: "B" as const },
  { name: "Mariana Carvalho", email: "mariana.carvalho@demo.pt", category: "B" as const },
  { name: "André Costa", email: "andre.costa@demo.pt", category: "A" as const },
  { name: "Joana Marques", email: "joana.marques@demo.pt", category: "B" as const },
  { name: "Bruno Pinto", email: "bruno.pinto@demo.pt", category: "BE" as const },
  { name: "Daniela Rocha", email: "daniela.rocha@demo.pt", category: "B" as const },
  { name: "Hugo Vieira", email: "hugo.vieira@demo.pt", category: "B" as const },
  { name: "Patrícia Nunes", email: "patricia.nunes@demo.pt", category: "B" as const },
  { name: "Nuno Cardoso", email: "nuno.cardoso@demo.pt", category: "C" as const },
  { name: "Rita Moreira", email: "rita.moreira@demo.pt", category: "B" as const },
  { name: "Vasco Tavares", email: "vasco.tavares@demo.pt", category: "B" as const },
  { name: "Mafalda Cunha", email: "mafalda.cunha@demo.pt", category: "B" as const },
];

const THEORY_TOPICS = [
  "Código da Estrada — Sinais",
  "Código da Estrada — Prioridades",
  "Código da Estrada — Manobras",
  "Segurança Rodoviária",
  "Mecânica Básica",
  "Condução Defensiva",
  "Primeiros Socorros",
  "Legislação Rodoviária",
  "Velocidade e Travagem",
  "Condução Noturna",
];

const PRACTICAL_NOTES = [
  "Boa evolução na condução urbana.",
  "Precisa de mais prática em rotundas.",
  "Estacionamento paralelo a melhorar.",
  "Condução em autoestrada — bom desempenho.",
  "Manobras de marcha-atrás a evoluir.",
  "Muito bem nas ultrapassagens.",
  "Atento à sinalização. Continuar assim.",
  "Trabalhar a antecipação em cruzamentos.",
  null,
  null,
];

const EXAM_LOCATIONS = [
  "Centro de Exames IMT — Lisboa",
  "Centro de Exames IMT — Sintra",
  "Centro de Exames IMT — Almada",
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function setTime(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Returns the date with a realistic exam hour set (9/10/11/14/15/16:00). */
function examTime(d: Date): Date {
  const hours = [9, 10, 11, 14, 15, 16];
  return setTime(d, hours[Math.floor(Math.random() * hours.length)], 0);
}

async function getOrCreateUser({
  email,
  name,
  role,
  tenantId,
  schoolId,
  phone,
  createdAt,
  qualifiedCategories = [],
}: {
  email: string;
  name: string;
  role: "ADMIN" | "SECRETARY" | "INSTRUCTOR" | "STUDENT";
  tenantId: string;
  schoolId: string;
  phone?: string;
  createdAt?: Date;
  qualifiedCategories?: readonly string[];
}): Promise<string> {
  const existing = await db.user.findFirst({
    where: { email, tenantId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const authUser = authUsers?.users?.find((u) => u.email === email);

  let authUserId: string;
  if (authUser) {
    authUserId = authUser.id;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Auth error for ${email}: ${error.message}`);
    authUserId = data.user.id;
  }

  await db.user.create({
    data: {
      id: authUserId,
      tenantId,
      schoolId,
      email,
      name,
      phone,
      role,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      qualifiedCategories: qualifiedCategories as any,
      ...(createdAt && { createdAt }),
    },
  });

  console.log(`  Created: ${name} (${role})`);
  return authUserId;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Seeding demo data (6 months of history)…\n");

  // Tenant + School
  const tenant =
    (await db.tenant.findFirst({ where: { name: "Grupo Convlyx" } })) ??
    (await db.tenant.create({ data: { name: "Grupo Convlyx" } }));
  const school = await db.school.upsert({
    where: { subdomain: "demo" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Escola de Condução Lisboa Centro",
      subdomain: "demo",
      address: "Av. da Liberdade, 120, 1250-146 Lisboa",
      phone: "+351 210 123 456",
    },
  });
  console.log(`Tenant: ${tenant.name}`);
  console.log(`School: ${school.name}\n`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sixMonthsAgo = addDays(today, -180);

  // ─── Staff ───
  console.log("👥 Staff…");
  for (const s of STAFF) {
    await getOrCreateUser({
      email: s.email,
      name: s.name,
      role: s.role,
      tenantId: tenant.id,
      schoolId: school.id,
      phone: s.phone,
      createdAt: addDays(sixMonthsAgo, -7),
    });
  }

  // ─── Instructors ───
  console.log("\n🚗 Instructors…");
  const instructorIds: string[] = [];
  for (let i = 0; i < INSTRUCTORS.length; i++) {
    const inst = INSTRUCTORS[i];
    const id = await getOrCreateUser({
      email: inst.email,
      name: inst.name,
      role: "INSTRUCTOR",
      tenantId: tenant.id,
      schoolId: school.id,
      phone: inst.phone,
      qualifiedCategories: inst.categories,
      createdAt: addDays(sixMonthsAgo, -5 - i * 3),
    });
    instructorIds.push(id);
  }

  // ─── Students (spread createdAt across 6 months for analytics) ───
  console.log("\n📚 Students…");
  const studentIds: string[] = [];
  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i];
    // Spread roughly evenly over 6 months, with slight weighting toward recent
    // so the "new students" KPI for last 30d is non-zero.
    const daysAgo = Math.floor((i / STUDENTS.length) * 170) + Math.floor(Math.random() * 8);
    const createdAt = addDays(today, -daysAgo);
    const phone = `+351 9${10 + i} ${String(100 + i * 11).padStart(3, "0")} ${String(200 + i * 7).padStart(3, "0")}`;
    const id = await getOrCreateUser({
      email: s.email,
      name: s.name,
      role: "STUDENT",
      tenantId: tenant.id,
      schoolId: school.id,
      phone,
      createdAt,
    });
    studentIds.push(id);
  }

  const admin = await db.user.findFirstOrThrow({
    where: { tenantId: tenant.id, role: "ADMIN" },
    select: { id: true },
  });

  // ─── Student Courses ───
  // Each student gets exactly one course in their declared category.
  // Mix of statuses: most IN_PROGRESS, some COMPLETED (for pass-rate chart),
  // a few ABANDONED.
  console.log("\n🎓 Student courses…");
  const courseByStudent = new Map<string, { id: string; category: string }>();
  for (let i = 0; i < STUDENTS.length; i++) {
    const studentId = studentIds[i];
    const category = STUDENTS[i].category;
    // 20% COMPLETED, 5% ABANDONED, 75% IN_PROGRESS
    const r = (i * 7) % 20;
    const status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED" =
      r < 4 ? "COMPLETED" : r === 4 ? "ABANDONED" : "IN_PROGRESS";
    const startedDaysAgo = 40 + Math.floor(Math.random() * 140);
    const startedAt = addDays(today, -startedDaysAgo);
    const completedAt = status === "COMPLETED" ? addDays(startedAt, 60 + Math.floor(Math.random() * 60)) : null;
    const course = await db.studentCourse.create({
      data: {
        tenantId: tenant.id,
        schoolId: school.id,
        studentId,
        category: category as never,
        status,
        startedAt,
        completedAt,
      },
      select: { id: true, category: true },
    });
    courseByStudent.set(studentId, { id: course.id, category: course.category });
  }

  // ─── ClassSessions: 6 months past + this week + 3 weeks ahead ───
  //
  // Density model: the calendar's default views (today, this week, last/next
  // week) need to look busy for screenshots, but older history just needs to
  // exist so analytics renders trends. So:
  //   * "Visible window" (today ± 14 days past, +21 days ahead): concurrent
  //     practical slots across 2-4 instructors at the same hour.
  //   * Older history: 1 instructor per slot, fewer slots — keeps row counts
  //     reasonable.
  //   * Today specifically: extra-packed regardless of weekday; statuses
  //     respect actual current time (morning slots → COMPLETED, late slots →
  //     SCHEDULED, the slot crossing "now" → IN_PROGRESS).
  console.log("\n📅 Classes (6 months back → 3 weeks ahead)…");
  const enrollmentsToCreate: Array<{
    sessionId: string;
    studentId: string;
    status: "ENROLLED" | "ATTENDED" | "NO_SHOW";
    notes: string | null;
    enrolledAt: Date;
  }> = [];

  const now = new Date();
  const dayLimit = addDays(today, 21);
  let theoryCount = 0;
  let practicalCount = 0;
  let cancelledCount = 0;
  let inProgressCount = 0;

  // Used to vary student selection deterministically across concurrent slots
  // so the same student isn't double-booked at the same hour.
  let studentCursor = 0;
  function nextStudentIds(n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      out.push(studentIds[studentCursor % studentIds.length]);
      studentCursor += 1;
    }
    return out;
  }

  function statusForDate(startsAt: Date, endsAt: Date, isCancelled: boolean): "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" {
    if (isCancelled) return "CANCELLED";
    if (endsAt <= now) return "COMPLETED";
    if (startsAt <= now && endsAt > now) return "IN_PROGRESS";
    return "SCHEDULED";
  }

  for (let cursor = new Date(sixMonthsAgo); cursor <= dayLimit; cursor = addDays(cursor, 1)) {
    const dow = cursor.getDay(); // 0=Sun
    if (dow === 0) continue; // closed Sundays

    const daysFromToday = Math.round((cursor.getTime() - today.getTime()) / 86400000);
    const isToday = daysFromToday === 0;
    const inVisibleWindow = isToday || (daysFromToday >= -14 && daysFromToday <= 21);

    // ─ Theory classes
    // Evening theory Mon/Wed/Fri at 18:00 — the recurring "código da estrada" slot.
    if ((dow === 1 || dow === 3 || dow === 5) && Math.random() > 0.05) {
      await createTheoryClass(cursor, 18, 19, 0, inVisibleWindow);
    }
    // Visible-window extras: morning theory on Tue/Thu sometimes, lunchtime on Mon/Wed.
    if (inVisibleWindow && (dow === 2 || dow === 4) && Math.random() > 0.5) {
      await createTheoryClass(cursor, 10, 11, 1, true);
    }
    if (inVisibleWindow && (dow === 1 || dow === 3) && Math.random() > 0.65) {
      await createTheoryClass(cursor, 12, 13, 2, true);
    }
    // Saturday morning theory
    if (dow === 6 && inVisibleWindow && Math.random() > 0.4) {
      await createTheoryClass(cursor, 10, 11, 0, true);
    }

    // ─ Practical classes — concurrent slots with multiple instructors
    const practicalHours = dow === 6 ? [9, 11] : [9, 11, 14, 16];

    for (const hour of practicalHours) {
      // How many instructors run concurrent practicals in this slot.
      // - Today: pack hard (3-4 concurrent)
      // - Visible window: 2-3 concurrent, occasionally 4
      // - Old history: 0-2 (mostly 1; sometimes empty slot for variety)
      let numConcurrent: number;
      if (isToday) {
        numConcurrent = 3 + Math.floor(Math.random() * 2); // 3-4
      } else if (inVisibleWindow) {
        numConcurrent = 2 + Math.floor(Math.random() * 3); // 2-4
      } else {
        const r = Math.random();
        numConcurrent = r < 0.35 ? 0 : r < 0.85 ? 1 : 2;
      }
      if (numConcurrent === 0) continue;

      // Distinct instructors, distinct students per slot
      const shuffledInstr = [...instructorIds].sort(() => Math.random() - 0.5).slice(0, numConcurrent);
      const slotStudents = nextStudentIds(numConcurrent);

      for (let i = 0; i < shuffledInstr.length; i++) {
        const startsAt = setTime(cursor, hour, 0);
        const endsAt = setTime(cursor, hour + 1, 30);
        // Past classes: occasional cancellation. Don't cancel future ones.
        const isCancelled = endsAt < now && Math.random() < 0.025;
        const status = statusForDate(startsAt, endsAt, isCancelled);

        const session = await db.classSession.create({
          data: {
            tenantId: tenant.id,
            schoolId: school.id,
            classType: "PRACTICAL",
            category: "B" as never,
            instructorId: shuffledInstr[i],
            title: "Aula Prática",
            startsAt,
            endsAt,
            capacity: 1,
            status,
            createdById: admin.id,
            updatedById: admin.id,
          },
          select: { id: true },
        });
        practicalCount += 1;
        if (status === "CANCELLED") cancelledCount += 1;
        if (status === "IN_PROGRESS") inProgressCount += 1;

        if (status !== "CANCELLED") {
          const wasInPast = endsAt < now;
          const attended = wasInPast ? Math.random() > 0.08 : false;
          enrollmentsToCreate.push({
            sessionId: session.id,
            studentId: slotStudents[i],
            status: wasInPast
              ? attended
                ? "ATTENDED"
                : "NO_SHOW"
              : "ENROLLED",
            notes: wasInPast && attended ? pickRandom(PRACTICAL_NOTES) : null,
            enrolledAt: addDays(startsAt, -2),
          });
        }
      }
    }
  }

  // Helper: create a theory class for the given day, with enrollments.
  // Hoisted above the loop via function declaration semantics in JS.
  async function createTheoryClass(
    date: Date,
    startHour: number,
    endHour: number,
    instructorIdx: number,
    isVisibleWindow: boolean
  ) {
    const rawIdx = Math.floor((today.getTime() - date.getTime()) / 86400000) + instructorIdx + startHour;
    const title = pick(THEORY_TOPICS, rawIdx);
    const startsAt = setTime(date, startHour, 0);
    const endsAt = setTime(date, endHour, 0);

    const isCancelled = endsAt < now && Math.random() < 0.04;
    const status = statusForDate(startsAt, endsAt, isCancelled);

    const session = await db.classSession.create({
      data: {
        tenantId: tenant.id,
        schoolId: school.id,
        classType: "THEORY",
        category: "B" as never,
        instructorId: pick(instructorIds, instructorIdx),
        title: isCancelled ? `${title} (Cancelada)` : title,
        startsAt,
        endsAt,
        capacity: 20,
        status,
        createdById: admin.id,
        updatedById: admin.id,
      },
      select: { id: true },
    });
    theoryCount += 1;
    if (status === "CANCELLED") cancelledCount += 1;
    if (status === "IN_PROGRESS") inProgressCount += 1;

    if (status === "CANCELLED") return;

    const wasInPast = endsAt < now;
    const numStudents = wasInPast
      ? (isVisibleWindow ? 11 : 9) + Math.floor(Math.random() * 7)
      : 5 + Math.floor(Math.random() * 7);
    const shuffled = [...studentIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(numStudents, shuffled.length); i++) {
      const enrolledAt = wasInPast
        ? addDays(startsAt, -3 - Math.floor(Math.random() * 7))
        : addDays(startsAt, -5);
      enrollmentsToCreate.push({
        sessionId: session.id,
        studentId: shuffled[i],
        status: wasInPast ? (Math.random() > 0.13 ? "ATTENDED" : "NO_SHOW") : "ENROLLED",
        notes: null,
        enrolledAt,
      });
    }
  }

  // Bulk-insert enrollments in chunks
  console.log(`  Theory classes: ${theoryCount}`);
  console.log(`  Practical classes: ${practicalCount}`);
  console.log(`  Cancelled: ${cancelledCount}`);
  console.log(`  In progress now: ${inProgressCount}`);
  console.log(`  Enrollments to create: ${enrollmentsToCreate.length}`);

  const CHUNK = 200;
  for (let i = 0; i < enrollmentsToCreate.length; i += CHUNK) {
    const slice = enrollmentsToCreate.slice(i, i + CHUNK);
    await db.enrollment.createMany({
      data: slice.map((e) => ({
        tenantId: tenant.id,
        schoolId: school.id,
        sessionId: e.sessionId,
        studentId: e.studentId,
        status: e.status,
        notes: e.notes,
        enrolledAt: e.enrolledAt,
      })),
      skipDuplicates: true,
    });
  }

  // ─── Exams ───
  // For each student, derive exam history from course status:
  //   COMPLETED course → theory PASSED + practical PASSED
  //   IN_PROGRESS course (started >90 days ago) → theory PASSED, practical scheduled or 1 FAILED attempt
  //   IN_PROGRESS course (started >150 days ago) → theory PASSED + practical PASSED still possible
  //   IN_PROGRESS course (started recently) → may have theory scheduled or none
  //   ABANDONED → may have a FAILED theory
  console.log("\n🎯 Exams…");
  let examCount = 0;
  let scheduledExamCount = 0;

  for (let i = 0; i < studentIds.length; i++) {
    const studentId = studentIds[i];
    const course = courseByStudent.get(studentId);
    if (!course) continue;

    const studentCourse = await db.studentCourse.findUniqueOrThrow({
      where: { id: course.id },
      select: { id: true, status: true, startedAt: true, category: true },
    });
    const daysSinceStart = Math.floor((today.getTime() - studentCourse.startedAt.getTime()) / 86400000);

    if (studentCourse.status === "COMPLETED") {
      // Theory PASSED ~50-80 days after course start
      const theoryAt = addDays(studentCourse.startedAt, 55 + Math.floor(Math.random() * 25));
      await db.exam.create({
        data: {
          tenantId: tenant.id,
          schoolId: school.id,
          courseId: studentCourse.id,
          type: "THEORY",
          scheduledAt: examTime(theoryAt),
          location: pickRandom(EXAM_LOCATIONS),
          result: "PASSED",
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
      // Practical PASSED ~30-60 days after theory
      const practAt = addDays(theoryAt, 30 + Math.floor(Math.random() * 30));
      await db.exam.create({
        data: {
          tenantId: tenant.id,
          schoolId: school.id,
          courseId: studentCourse.id,
          type: "PRACTICAL",
          scheduledAt: examTime(practAt),
          location: pickRandom(EXAM_LOCATIONS),
          result: "PASSED",
          instructorId: pick(instructorIds, i),
          examinerNotes: "Conduziu com confiança. Bom respeito pelas regras.",
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
      examCount += 2;
    } else if (studentCourse.status === "ABANDONED") {
      // A failed theory and they gave up
      const theoryAt = addDays(studentCourse.startedAt, 45 + Math.floor(Math.random() * 30));
      await db.exam.create({
        data: {
          tenantId: tenant.id,
          schoolId: school.id,
          courseId: studentCourse.id,
          type: "THEORY",
          scheduledAt: examTime(theoryAt),
          location: pickRandom(EXAM_LOCATIONS),
          result: "FAILED",
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
      examCount += 1;
    } else {
      // IN_PROGRESS — branch by how long they've been training
      if (daysSinceStart > 60) {
        // Has had at least one theory attempt
        const theoryAt = addDays(studentCourse.startedAt, 55 + Math.floor(Math.random() * 15));
        const firstFailed = Math.random() < 0.25;
        if (firstFailed) {
          // First attempt failed
          await db.exam.create({
            data: {
              tenantId: tenant.id,
              schoolId: school.id,
              courseId: studentCourse.id,
              type: "THEORY",
              scheduledAt: examTime(theoryAt),
              location: pickRandom(EXAM_LOCATIONS),
              result: "FAILED",
              createdById: admin.id,
              updatedById: admin.id,
            },
          });
          examCount += 1;
          // Then a second attempt: passed (if enough time) or scheduled for the future
          const secondAt = addDays(theoryAt, 25);
          if (secondAt < today) {
            await db.exam.create({
              data: {
                tenantId: tenant.id,
                schoolId: school.id,
                courseId: studentCourse.id,
                type: "THEORY",
                scheduledAt: examTime(secondAt),
                location: pickRandom(EXAM_LOCATIONS),
                result: "PASSED",
                createdById: admin.id,
                updatedById: admin.id,
              },
            });
            examCount += 1;
            // Maybe practical scheduled for next 2 weeks
            if (Math.random() < 0.5) {
              await db.exam.create({
                data: {
                  tenantId: tenant.id,
                  schoolId: school.id,
                  courseId: studentCourse.id,
                  type: "PRACTICAL",
                  scheduledAt: examTime(addDays(today, 3 + Math.floor(Math.random() * 14))),
                  location: pickRandom(EXAM_LOCATIONS),
                  result: "SCHEDULED",
                  instructorId: pick(instructorIds, i),
                  createdById: admin.id,
                  updatedById: admin.id,
                },
              });
              scheduledExamCount += 1;
            }
          } else {
            // Second attempt is in the future
            await db.exam.create({
              data: {
                tenantId: tenant.id,
                schoolId: school.id,
                courseId: studentCourse.id,
                type: "THEORY",
                scheduledAt: examTime(secondAt),
                location: pickRandom(EXAM_LOCATIONS),
                result: "SCHEDULED",
                createdById: admin.id,
                updatedById: admin.id,
              },
            });
            scheduledExamCount += 1;
          }
        } else {
          // First attempt passed
          await db.exam.create({
            data: {
              tenantId: tenant.id,
              schoolId: school.id,
              courseId: studentCourse.id,
              type: "THEORY",
              scheduledAt: examTime(theoryAt),
              location: pickRandom(EXAM_LOCATIONS),
              result: "PASSED",
              createdById: admin.id,
              updatedById: admin.id,
            },
          });
          examCount += 1;
          // Practical: either passed, failed once + scheduled, or just scheduled
          if (daysSinceStart > 130) {
            const practAt = addDays(theoryAt, 40 + Math.floor(Math.random() * 30));
            const practResult: "PASSED" | "FAILED" | "NO_SHOW" =
              Math.random() < 0.7 ? "PASSED" : Math.random() < 0.5 ? "FAILED" : "NO_SHOW";
            await db.exam.create({
              data: {
                tenantId: tenant.id,
                schoolId: school.id,
                courseId: studentCourse.id,
                type: "PRACTICAL",
                scheduledAt: examTime(practAt),
                location: pickRandom(EXAM_LOCATIONS),
                result: practResult,
                instructorId: pick(instructorIds, i),
                examinerNotes:
                  practResult === "PASSED"
                    ? "Boa condução, sem incidentes relevantes."
                    : practResult === "FAILED"
                      ? "Cometeu erro grave em manobra de estacionamento."
                      : null,
                createdById: admin.id,
                updatedById: admin.id,
              },
            });
            examCount += 1;
          } else if (Math.random() < 0.4) {
            // Practical scheduled for upcoming weeks
            await db.exam.create({
              data: {
                tenantId: tenant.id,
                schoolId: school.id,
                courseId: studentCourse.id,
                type: "PRACTICAL",
                scheduledAt: examTime(addDays(today, 2 + Math.floor(Math.random() * 18))),
                location: pickRandom(EXAM_LOCATIONS),
                result: "SCHEDULED",
                instructorId: pick(instructorIds, i),
                createdById: admin.id,
                updatedById: admin.id,
              },
            });
            scheduledExamCount += 1;
          }
        }
      } else if (daysSinceStart > 35) {
        // Has a theory exam scheduled for the next 2 weeks
        await db.exam.create({
          data: {
            tenantId: tenant.id,
            schoolId: school.id,
            courseId: studentCourse.id,
            type: "THEORY",
            scheduledAt: examTime(addDays(today, 1 + Math.floor(Math.random() * 14))),
            location: pickRandom(EXAM_LOCATIONS),
            result: "SCHEDULED",
            createdById: admin.id,
            updatedById: admin.id,
          },
        });
        scheduledExamCount += 1;
      }
      // else: too new, no exam yet
    }
  }

  // ─── Visible scheduled exams — populate today + next ~7 days so the
  // calendar default view always has something to render. Targets students
  // whose course doesn't already have a same-type SCHEDULED exam.
  console.log("\n📍 Visible exams (today + next 7 days)…");
  const studentsWithScheduledTheory = new Set(
    (
      await db.exam.findMany({
        where: { tenantId: tenant.id, type: "THEORY", result: "SCHEDULED" },
        select: { course: { select: { studentId: true } } },
      })
    ).map((e) => e.course.studentId)
  );
  const studentsWithScheduledPractical = new Set(
    (
      await db.exam.findMany({
        where: { tenantId: tenant.id, type: "PRACTICAL", result: "SCHEDULED" },
        select: { course: { select: { studentId: true } } },
      })
    ).map((e) => e.course.studentId)
  );
  // Students whose course has theory PASSED (eligible for a practical exam)
  const studentsTheoryPassed = new Set(
    (
      await db.exam.findMany({
        where: { tenantId: tenant.id, type: "THEORY", result: "PASSED" },
        select: { course: { select: { studentId: true } } },
      })
    ).map((e) => e.course.studentId)
  );

  // Schedule slots — today afternoon, tomorrow morning, this week, next week.
  const visibleSlots: Array<{ type: "THEORY" | "PRACTICAL"; daysAhead: number; hour: number }> = [
    { type: "THEORY", daysAhead: 0, hour: 14 },
    { type: "PRACTICAL", daysAhead: 0, hour: 16 },
    { type: "THEORY", daysAhead: 1, hour: 9 },
    { type: "PRACTICAL", daysAhead: 2, hour: 11 },
    { type: "THEORY", daysAhead: 4, hour: 14 },
    { type: "PRACTICAL", daysAhead: 7, hour: 10 },
  ];

  let visibleExamCount = 0;
  for (const slot of visibleSlots) {
    // Pick a student who doesn't already have a matching SCHEDULED exam.
    const pool =
      slot.type === "THEORY"
        ? studentIds.filter((id) => !studentsWithScheduledTheory.has(id))
        : studentIds.filter(
            (id) => studentsTheoryPassed.has(id) && !studentsWithScheduledPractical.has(id)
          );
    if (pool.length === 0) continue;

    const studentId = pool[visibleExamCount % pool.length];
    const course = courseByStudent.get(studentId);
    if (!course) continue;

    // Practical needs a theory PASSED on the same course
    if (slot.type === "PRACTICAL") {
      const theoryPassed = await db.exam.findFirst({
        where: { courseId: course.id, type: "THEORY", result: "PASSED" },
        select: { id: true },
      });
      if (!theoryPassed) continue;
    }

    const scheduledAt = setTime(addDays(today, slot.daysAhead), slot.hour, 0);
    await db.exam.create({
      data: {
        tenantId: tenant.id,
        schoolId: school.id,
        courseId: course.id,
        type: slot.type,
        scheduledAt,
        location: pickRandom(EXAM_LOCATIONS),
        result: "SCHEDULED",
        instructorId: slot.type === "PRACTICAL" ? pick(instructorIds, visibleExamCount) : null,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    // Track so the next slot doesn't reuse this student for the same exam type.
    if (slot.type === "THEORY") studentsWithScheduledTheory.add(studentId);
    else studentsWithScheduledPractical.add(studentId);

    visibleExamCount += 1;
    scheduledExamCount += 1;
  }

  console.log(`  Historical exams: ${examCount}`);
  console.log(`  Scheduled exams: ${scheduledExamCount}  (incl. ${visibleExamCount} forced-visible)`);

  // ─── Notifications ───
  console.log("\n🔔 Notifications…");
  // Sprinkle ~30 notifications across users in the last 2 weeks
  const notifTypes = [
    {
      type: "class.scheduled",
      title: "Nova aula agendada",
      message: "A sua aula prática foi agendada para amanhã às 10:00.",
    },
    {
      type: "enrollment.confirmed",
      title: "Inscrição confirmada",
      message: "A sua inscrição na aula teórica foi confirmada.",
    },
    {
      type: "class.cancelled",
      title: "Aula cancelada",
      message: "A aula de hoje foi cancelada pelo instrutor. Será reagendada.",
    },
    {
      type: "exam.scheduled",
      title: "Exame teórico marcado",
      message: "O seu exame teórico foi marcado. Confira a hora e local.",
    },
    {
      type: "attendance.marked",
      title: "Presença registada",
      message: "A sua presença na aula foi registada.",
    },
  ];
  let notifCount = 0;
  for (let i = 0; i < 30; i++) {
    const userId = pickRandom(studentIds);
    const n = pickRandom(notifTypes);
    const daysAgo = Math.floor(Math.random() * 14);
    const createdAt = addDays(today, -daysAgo);
    createdAt.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
    await db.notification.create({
      data: {
        tenantId: tenant.id,
        schoolId: school.id,
        userId,
        type: n.type,
        title: n.title,
        message: n.message,
        read: daysAgo > 2 ? Math.random() > 0.3 : Math.random() > 0.7,
        createdAt,
      },
    });
    notifCount += 1;
  }
  console.log(`  ${notifCount} notifications`);

  console.log("\n✅ Demo seed complete.\n");
  console.log(`  Login (any account)  password: ${SEED_PASSWORD}`);
  console.log(`    admin:       admin@demo.pt`);
  console.log(`    secretária:  secretaria@demo.pt`);
  console.log(`    instrutor:   instrutor@demo.pt`);
  console.log(`    aluno:       aluno@demo.pt`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
