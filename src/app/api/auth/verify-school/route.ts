import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { extractSubdomain } from "@/lib/subdomain";

// Pin to Dublin (eu-west-1) to co-locate with Supabase — avoids transatlantic DB latency.
export const preferredRegion = "dub1";

/**
 * Post-login gate: is the just-authenticated user a member of the school whose
 * subdomain they logged in on? A person may belong to several schools, so this
 * answers strictly for THIS subdomain (derived from the request Host, since
 * middleware doesn't run for /api/*). Returns `{ valid }`.
 */
export async function GET(request: NextRequest) {
  // Rate limit: 20 requests per minute per IP
  const ip = getClientIp(request.headers);
  const { success } = await rateLimit({ key: `verify-school:${ip}`, limit: 20, windowMs: 60000 });
  if (!success) {
    return NextResponse.json({ valid: false }, { status: 429 });
  }

  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const subdomain = extractSubdomain(host);
    if (!subdomain) {
      return NextResponse.json({ valid: false });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ valid: false });
    }

    const school = await db.school.findUnique({
      where: { subdomain },
      select: { tenantId: true },
    });
    if (!school) {
      return NextResponse.json({ valid: false });
    }

    const membership = await db.membership.findFirst({
      where: { userId: user.id, tenantId: school.tenantId, status: "ACTIVE" },
      select: { userId: true },
    });

    return NextResponse.json({ valid: !!membership });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
