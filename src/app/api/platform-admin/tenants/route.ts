import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { isSameOrigin } from "@/lib/csrf";
import { audit } from "@/server/lib/audit";

// Pin to Dublin (eu-west-1) to co-locate with Supabase — avoids transatlantic DB latency.
export const preferredRegion = "dub1";

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
  if (!isSameOrigin(request.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
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

  await audit({
    db,
    actorEmail: admin.email ?? "unknown",
    action: "tenant.create",
    targetType: "tenant",
    targetId: tenant.id,
    metadata: { name: tenant.name },
  });

  return NextResponse.json(tenant);
}
