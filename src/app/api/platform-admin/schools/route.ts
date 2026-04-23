import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";

const ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function verifyPlatformAdmin() {
  const supabase = await createClient();
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

  const { name, subdomain, tenantId, address, phone } = await request.json();

  if (!name || !subdomain || !tenantId) {
    return NextResponse.json({ error: "Nome, subdomínio e grupo são obrigatórios" }, { status: 400 });
  }

  // Check subdomain isn't taken
  const existing = await db.school.findUnique({ where: { subdomain } });
  if (existing) {
    return NextResponse.json({ error: "Este subdomínio já está em uso" }, { status: 400 });
  }

  // Check tenant exists
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "Grupo não encontrado" }, { status: 400 });
  }

  const school = await db.school.create({
    data: {
      name,
      subdomain: subdomain.toLowerCase(),
      tenantId,
      address: address || null,
      phone: phone || null,
    },
  });

  return NextResponse.json(school);
}
