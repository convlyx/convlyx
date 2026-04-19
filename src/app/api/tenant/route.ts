import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

/**
 * Public endpoint — resolves tenant name from subdomain.
 * No auth required. Returns only the name (no sensitive data).
 */
export async function GET(request: NextRequest) {
  const subdomain = request.headers.get("x-tenant-subdomain");

  if (!subdomain) {
    return NextResponse.json({ name: null });
  }

  const tenant = await db.tenant.findUnique({
    where: { subdomain },
    select: { name: true },
  });

  return NextResponse.json({ name: tenant?.name ?? null });
}
