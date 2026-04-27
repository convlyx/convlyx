import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { db } from "@/server/db";

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
    // Roll back auth user on Prisma failure
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar utilizador" },
      { status: 500 },
    );
  }
}
