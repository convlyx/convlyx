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

  const { name } = await request.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const tenant = await db.tenant.create({
    data: { name },
  });

  return NextResponse.json(tenant);
}
