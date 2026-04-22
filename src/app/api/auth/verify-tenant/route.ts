import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ valid: false });
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { tenant: { select: { subdomain: true } } },
    });

    if (!dbUser) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      subdomain: dbUser.tenant.subdomain,
    });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
