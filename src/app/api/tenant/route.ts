import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

function extractSubdomain(hostname: string): string | null {
  if (hostname.startsWith("localhost") || hostname.startsWith("127.0.0.1")) {
    return null;
  }
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    return parts[0];
  }
  return null;
}

/**
 * Public endpoint — resolves tenant name from subdomain.
 * No auth required. Returns only the name (no sensitive data).
 */
export async function GET(request: NextRequest) {
  const hostname = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const subdomain = extractSubdomain(hostname);

  if (!subdomain) {
    return NextResponse.json({ name: null });
  }

  const tenant = await db.tenant.findUnique({
    where: { subdomain },
    select: { name: true },
  });

  return NextResponse.json({ name: tenant?.name ?? null });
}
