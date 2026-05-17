import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { isSameOrigin } from "@/lib/csrf";

const ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function verifyPlatformAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    return null;
  }
  return user;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = await verifyPlatformAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { schoolId, email, name, phone, password } = await request.json();

  if (!schoolId || !email || !name || !password) {
    return NextResponse.json(
      { error: "Escola, email, nome e palavra-passe são obrigatórios" },
      { status: 400 },
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "A palavra-passe deve ter pelo menos 8 caracteres" },
      { status: 400 },
    );
  }

  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { id: true, tenantId: true },
  });

  if (!school) {
    return NextResponse.json({ error: "Escola não encontrada" }, { status: 400 });
  }

  // Pre-flight: reject duplicates before touching Supabase Auth. Avoids the
  // most common cause of an orphaned auth row — Prisma's unique constraint
  // tripping after the auth user is already created.
  const existing = await db.user.findFirst({
    where: { tenantId: school.tenantId, email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um utilizador com este email nesta escola" },
      { status: 400 },
    );
  }

  // Create auth user with email confirmed and password set immediately
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Erro ao criar utilizador" },
      { status: 400 },
    );
  }

  try {
    const user = await db.user.create({
      data: {
        id: authData.user.id,
        tenantId: school.tenantId,
        schoolId: school.id,
        email,
        name,
        phone: phone || null,
        role: "ADMIN",
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    // Compensation: Prisma failed despite the pre-flight check (rare —
    // race condition, FK violation, DB outage). Roll back the auth user.
    // If the rollback itself fails, we log the orphan ID so an operator
    // can clean it up via the Supabase dashboard.
    const orphanId = authData.user.id;
    try {
      await supabaseAdmin.auth.admin.deleteUser(orphanId);
    } catch (e) {
      console.error(
        `[platform-admin] auth rollback FAILED — orphaned auth user id=${orphanId} email=${email}`,
        e,
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar utilizador" },
      { status: 500 },
    );
  }
}
