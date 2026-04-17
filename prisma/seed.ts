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

const seedUsers = [
  {
    email: "admin@demo.pt",
    name: "Admin Demo",
    role: "ADMIN" as const,
  },
  {
    email: "secretaria@demo.pt",
    name: "Maria Silva",
    role: "SECRETARY" as const,
  },
  {
    email: "instrutor@demo.pt",
    name: "João Santos",
    role: "INSTRUCTOR" as const,
  },
  {
    email: "aluno@demo.pt",
    name: "Ana Costa",
    role: "STUDENT" as const,
  },
];

async function main() {
  console.log("Seeding database...");

  // 1. Create tenant
  const tenant = await db.tenant.upsert({
    where: { subdomain: "demo" },
    update: {},
    create: {
      name: "Grupo Demo",
      subdomain: "demo",
    },
  });
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Create school
  const school = await db.school.upsert({
    where: { id: tenant.id }, // Will fail on first run, that's fine
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Escola de Condução Demo",
      address: "Rua do Exemplo, 123, Lisboa",
      phone: "+351 210 000 000",
    },
  });
  console.log(`School: ${school.name} (${school.id})`);

  // 3. Create users (Supabase auth + Prisma profile)
  for (const seedUser of seedUsers) {
    // Check if auth user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email === seedUser.email
    );

    let authUserId: string;

    if (existing) {
      authUserId = existing.id;
      console.log(`Auth user already exists: ${seedUser.email}`);
    } else {
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: seedUser.email,
          password: SEED_PASSWORD,
          email_confirm: true,
        });

      if (authError) {
        console.error(`Failed to create auth user ${seedUser.email}:`, authError);
        continue;
      }

      authUserId = authData.user.id;
      console.log(`Created auth user: ${seedUser.email}`);
    }

    // Upsert Prisma user profile
    await db.user.upsert({
      where: { id: authUserId },
      update: {
        name: seedUser.name,
        role: seedUser.role,
      },
      create: {
        id: authUserId,
        tenantId: tenant.id,
        schoolId: school.id,
        email: seedUser.email,
        name: seedUser.name,
        role: seedUser.role,
      },
    });

    console.log(`User: ${seedUser.name} (${seedUser.role})`);
  }

  console.log("\nSeed complete! Login with any of these accounts:");
  console.log(`Password for all: ${SEED_PASSWORD}`);
  seedUsers.forEach((u) => console.log(`  ${u.role}: ${u.email}`));
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
