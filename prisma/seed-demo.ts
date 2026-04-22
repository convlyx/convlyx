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

const SEED_PASSWORD = "password123";

// Realistic Portuguese names
const STUDENTS = [
  { name: "Ana Costa", email: "ana.costa@demo.pt" },
  { name: "Carlos Santos", email: "carlos.santos@demo.pt" },
  { name: "Maria Oliveira", email: "maria.oliveira@demo.pt" },
  { name: "Pedro Ferreira", email: "pedro.ferreira@demo.pt" },
  { name: "Sofia Rodrigues", email: "sofia.rodrigues@demo.pt" },
  { name: "Tiago Almeida", email: "tiago.almeida@demo.pt" },
  { name: "Beatriz Silva", email: "beatriz.silva@demo.pt" },
  { name: "Diogo Pereira", email: "diogo.pereira@demo.pt" },
  { name: "Inês Martins", email: "ines.martins@demo.pt" },
  { name: "Rafael Sousa", email: "rafael.sousa@demo.pt" },
  { name: "Catarina Lopes", email: "catarina.lopes@demo.pt" },
  { name: "Miguel Fernandes", email: "miguel.fernandes@demo.pt" },
  { name: "Leonor Gonçalves", email: "leonor.goncalves@demo.pt" },
  { name: "Gonçalo Ribeiro", email: "goncalo.ribeiro@demo.pt" },
  { name: "Mariana Carvalho", email: "mariana.carvalho@demo.pt" },
];

const INSTRUCTORS = [
  { name: "João Santos", email: "instrutor@demo.pt" }, // existing
  { name: "Fernando Mendes", email: "fernando.mendes@demo.pt" },
  { name: "Paula Teixeira", email: "paula.teixeira@demo.pt" },
];

const STAFF = [
  { name: "Admin Demo", email: "admin@demo.pt", role: "ADMIN" as const },
  { name: "Maria Silva", email: "secretaria@demo.pt", role: "SECRETARY" as const },
];

async function getOrCreateUser(
  email: string,
  name: string,
  role: "ADMIN" | "SECRETARY" | "INSTRUCTOR" | "STUDENT",
  tenantId: string,
  schoolId: string,
  phone?: string
): Promise<string> {
  // Check if already exists in our DB
  const existing = await db.user.findFirst({
    where: { email, tenantId },
    select: { id: true },
  });

  if (existing) {
    console.log(`  Exists: ${email}`);
    return existing.id;
  }

  // Check if auth user exists
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
    },
  });

  console.log(`  Created: ${name} (${role})`);
  return authUserId;
}

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

async function main() {
  console.log("🚀 Seeding demo data...\n");

  // Get or create tenant
  let tenant = await db.tenant.findUnique({ where: { subdomain: "demo" } });
  if (!tenant) {
    tenant = await db.tenant.create({
      data: { name: "Grupo Demo", subdomain: "demo" },
    });
  }
  console.log(`Tenant: ${tenant.name}\n`);

  // Get or create school
  let school = await db.school.findFirst({ where: { tenantId: tenant.id } });
  if (!school) {
    school = await db.school.create({
      data: {
        tenantId: tenant.id,
        name: "Escola de Condução Demo",
        address: "Av. da Liberdade, 120, 1250-146 Lisboa",
        phone: "+351 210 123 456",
      },
    });
  }
  console.log(`School: ${school.name}\n`);

  // Create staff
  console.log("👥 Creating staff...");
  for (const s of STAFF) {
    await getOrCreateUser(s.email, s.name, s.role, tenant.id, school.id);
  }

  // Create instructors
  console.log("\n🚗 Creating instructors...");
  const instructorIds: string[] = [];
  const phones = ["+351 912 345 678", "+351 923 456 789", "+351 934 567 890"];
  for (let i = 0; i < INSTRUCTORS.length; i++) {
    const id = await getOrCreateUser(
      INSTRUCTORS[i].email,
      INSTRUCTORS[i].name,
      "INSTRUCTOR",
      tenant.id,
      school.id,
      phones[i]
    );
    instructorIds.push(id);
  }

  // Create students
  console.log("\n📚 Creating students...");
  const studentIds: string[] = [];
  for (let i = 0; i < STUDENTS.length; i++) {
    const phone = `+351 9${10 + i} ${100 + i * 11} ${200 + i * 7}`;
    const id = await getOrCreateUser(
      STUDENTS[i].email,
      STUDENTS[i].name,
      "STUDENT",
      tenant.id,
      school.id,
      phone
    );
    studentIds.push(id);
  }

  // Get admin user for createdBy/updatedBy
  const admin = await db.user.findFirst({
    where: { tenantId: tenant.id, role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) throw new Error("Admin not found");

  // ─── PAST CLASSES (last 4 weeks) ───
  console.log("\n📅 Creating past classes...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const theoryTopics = [
    "Código da Estrada — Sinais",
    "Código da Estrada — Prioridades",
    "Código da Estrada — Manobras",
    "Segurança Rodoviária",
    "Mecânica Básica",
    "Condução Defensiva",
    "Primeiros Socorros",
    "Legislação Rodoviária",
  ];

  for (let week = 4; week >= 1; week--) {
    const weekStart = addDays(today, -week * 7);

    // Monday & Wednesday theory classes at 18:00
    for (const dayOffset of [0, 2]) {
      const classDate = addDays(weekStart, dayOffset);
      if (classDate >= today) continue;

      const topicIndex = ((4 - week) * 2 + (dayOffset === 0 ? 0 : 1)) % theoryTopics.length;
      const startsAt = setTime(classDate, 18, 0);
      const endsAt = setTime(classDate, 19, 0);

      const session = await db.classSession.create({
        data: {
          tenantId: tenant.id,
          schoolId: school.id,
          classType: "THEORY",
          instructorId: instructorIds[0],
          title: theoryTopics[topicIndex],
          startsAt,
          endsAt,
          capacity: 20,
          status: "COMPLETED",
          createdById: admin.id,
          updatedById: admin.id,
        },
      });

      // Enroll 8-15 random students
      const numStudents = 8 + Math.floor(Math.random() * 8);
      const shuffled = [...studentIds].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(numStudents, shuffled.length); i++) {
        const attended = Math.random() > 0.15; // 85% attendance
        await db.enrollment.create({
          data: {
            tenantId: tenant.id,
            sessionId: session.id,
            studentId: shuffled[i],
            status: attended ? "ATTENDED" : "NO_SHOW",
          },
        });
      }

      console.log(`  Theory: ${theoryTopics[topicIndex]} (${classDate.toLocaleDateString("pt-PT")})`);
    }

    // Tuesday & Thursday practical classes (3 per day)
    for (const dayOffset of [1, 3]) {
      const classDate = addDays(weekStart, dayOffset);
      if (classDate >= today) continue;

      for (let slot = 0; slot < 3; slot++) {
        const hour = 9 + slot * 2; // 9:00, 11:00, 13:00
        const instrIndex = slot % instructorIds.length;
        const studentIndex = ((4 - week) * 6 + dayOffset * 3 + slot) % studentIds.length;

        const startsAt = setTime(classDate, hour, 0);
        const endsAt = setTime(classDate, hour + 1, 30);

        const session = await db.classSession.create({
          data: {
            tenantId: tenant.id,
            schoolId: school.id,
            classType: "PRACTICAL",
            instructorId: instructorIds[instrIndex],
            title: "Aula Prática",
            startsAt,
            endsAt,
            capacity: 1,
            status: "COMPLETED",
            createdById: admin.id,
            updatedById: admin.id,
          },
        });

        const attended = Math.random() > 0.1;
        const notes = attended
          ? [
              "Boa evolução na condução urbana.",
              "Precisa de mais prática em rotundas.",
              "Estacionamento paralelo a melhorar.",
              "Condução em autoestrada — bom desempenho.",
              "Manobras de marcha-atrás a evoluir.",
              "Muito bem nas ultrapassagens.",
              null,
              null,
            ][Math.floor(Math.random() * 8)]
          : null;

        await db.enrollment.create({
          data: {
            tenantId: tenant.id,
            sessionId: session.id,
            studentId: studentIds[studentIndex],
            status: attended ? "ATTENDED" : "NO_SHOW",
            notes,
          },
        });
      }
      console.log(`  Practical: 3 classes (${classDate.toLocaleDateString("pt-PT")})`);
    }
  }

  // ─── THIS WEEK (current) ───
  console.log("\n📅 Creating this week's classes...");
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayThisWeek = addDays(today, -(dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  // Theory: Mon & Wed 18:00-19:00
  for (const dayOffset of [0, 2]) {
    const classDate = addDays(mondayThisWeek, dayOffset);
    const isPast = classDate < today;
    const isToday = classDate.toDateString() === today.toDateString();

    const startsAt = setTime(classDate, 18, 0);
    const endsAt = setTime(classDate, 19, 0);

    const session = await db.classSession.create({
      data: {
        tenantId: tenant.id,
        schoolId: school.id,
        classType: "THEORY",
        instructorId: instructorIds[0],
        title: dayOffset === 0 ? "Código da Estrada — Revisão" : "Simulação de Exame Teórico",
        startsAt,
        endsAt,
        capacity: 20,
        status: isPast ? "COMPLETED" : isToday ? "SCHEDULED" : "SCHEDULED",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    // Enroll students
    const numStudents = 10 + Math.floor(Math.random() * 5);
    const shuffled = [...studentIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(numStudents, shuffled.length); i++) {
      await db.enrollment.create({
        data: {
          tenantId: tenant.id,
          sessionId: session.id,
          studentId: shuffled[i],
          status: isPast ? (Math.random() > 0.1 ? "ATTENDED" : "NO_SHOW") : "ENROLLED",
        },
      });
    }
    console.log(`  Theory: ${session.title} (${classDate.toLocaleDateString("pt-PT")}) [${isPast ? "COMPLETED" : "SCHEDULED"}]`);
  }

  // Practical: Tue-Fri, 3 per day
  for (const dayOffset of [1, 2, 3, 4]) {
    const classDate = addDays(mondayThisWeek, dayOffset);
    const isPast = classDate < today;

    for (let slot = 0; slot < 3; slot++) {
      const hour = 9 + slot * 2;
      const instrIndex = slot % instructorIds.length;
      const studentIndex = (dayOffset * 3 + slot) % studentIds.length;

      const session = await db.classSession.create({
        data: {
          tenantId: tenant.id,
          schoolId: school.id,
          classType: "PRACTICAL",
          instructorId: instructorIds[instrIndex],
          title: "Aula Prática",
          startsAt: setTime(classDate, hour, 0),
          endsAt: setTime(classDate, hour + 1, 30),
          capacity: 1,
          status: isPast ? "COMPLETED" : "SCHEDULED",
          createdById: admin.id,
          updatedById: admin.id,
        },
      });

      await db.enrollment.create({
        data: {
          tenantId: tenant.id,
          sessionId: session.id,
          studentId: studentIds[studentIndex],
          status: isPast ? "ATTENDED" : "ENROLLED",
          notes: isPast && Math.random() > 0.5 ? "Boa evolução." : null,
        },
      });
    }
    console.log(`  Practical: 3 classes (${classDate.toLocaleDateString("pt-PT")}) [${isPast ? "COMPLETED" : "SCHEDULED"}]`);
  }

  // ─── NEXT 2 WEEKS ───
  console.log("\n📅 Creating future classes...");
  for (let week = 1; week <= 2; week++) {
    const weekStart = addDays(mondayThisWeek, week * 7);

    // Theory: Mon & Wed
    for (const dayOffset of [0, 2]) {
      const classDate = addDays(weekStart, dayOffset);
      const topicIndex = (week * 2 + (dayOffset === 0 ? 0 : 1)) % theoryTopics.length;

      const session = await db.classSession.create({
        data: {
          tenantId: tenant.id,
          schoolId: school.id,
          classType: "THEORY",
          instructorId: instructorIds[0],
          title: theoryTopics[topicIndex],
          startsAt: setTime(classDate, 18, 0),
          endsAt: setTime(classDate, 19, 0),
          capacity: 20,
          status: "SCHEDULED",
          createdById: admin.id,
          updatedById: admin.id,
        },
      });

      // Some students already enrolled
      const numEnrolled = 3 + Math.floor(Math.random() * 5);
      const shuffled = [...studentIds].sort(() => Math.random() - 0.5);
      for (let i = 0; i < numEnrolled; i++) {
        await db.enrollment.create({
          data: {
            tenantId: tenant.id,
            sessionId: session.id,
            studentId: shuffled[i],
            status: "ENROLLED",
          },
        });
      }
      console.log(`  Theory: ${theoryTopics[topicIndex]} (${classDate.toLocaleDateString("pt-PT")}) [${numEnrolled} enrolled]`);
    }

    // Practical: Tue-Fri
    for (const dayOffset of [1, 2, 3, 4]) {
      const classDate = addDays(weekStart, dayOffset);

      for (let slot = 0; slot < 3; slot++) {
        const hour = 9 + slot * 2;
        const instrIndex = slot % instructorIds.length;
        const studentIndex = (week * 12 + dayOffset * 3 + slot) % studentIds.length;

        const session = await db.classSession.create({
          data: {
            tenantId: tenant.id,
            schoolId: school.id,
            classType: "PRACTICAL",
            instructorId: instructorIds[instrIndex],
            title: "Aula Prática",
            startsAt: setTime(classDate, hour, 0),
            endsAt: setTime(classDate, hour + 1, 30),
            capacity: 1,
            status: "SCHEDULED",
            createdById: admin.id,
            updatedById: admin.id,
          },
        });

        await db.enrollment.create({
          data: {
            tenantId: tenant.id,
            sessionId: session.id,
            studentId: studentIds[studentIndex],
            status: "ENROLLED",
          },
        });
      }
      console.log(`  Practical: 3 classes (${classDate.toLocaleDateString("pt-PT")})`);
    }
  }

  // One cancelled class for realism
  const cancelledDate = addDays(today, 3);
  await db.classSession.create({
    data: {
      tenantId: tenant.id,
      schoolId: school.id,
      classType: "THEORY",
      instructorId: instructorIds[1],
      title: "Condução Noturna — CANCELADA",
      startsAt: setTime(cancelledDate, 19, 0),
      endsAt: setTime(cancelledDate, 20, 0),
      capacity: 20,
      status: "CANCELLED",
      createdById: admin.id,
      updatedById: admin.id,
    },
  });
  console.log(`\n  Cancelled: Condução Noturna (${cancelledDate.toLocaleDateString("pt-PT")})`);

  console.log("\n✅ Demo data seeded successfully!");
  console.log(`\n  Students: ${STUDENTS.length}`);
  console.log(`  Instructors: ${INSTRUCTORS.length}`);
  console.log(`  Staff: ${STAFF.length}`);
  console.log(`\n  Login with any account, password: ${SEED_PASSWORD}`);
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
