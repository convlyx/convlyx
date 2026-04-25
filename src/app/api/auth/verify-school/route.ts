import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // Rate limit: 20 requests per minute per IP
  const ip = getClientIp(request.headers);
  const { success } = rateLimit({ key: `verify-school:${ip}`, limit: 20, windowMs: 60000 });
  if (!success) {
    return NextResponse.json({ valid: false }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ valid: false });
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { school: { select: { subdomain: true } } },
    });

    if (!dbUser) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      subdomain: dbUser.school.subdomain,
    });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
