import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/csrf";
import { extractSubdomain } from "@/lib/subdomain";
import { logger } from "@/lib/logger";

// Pin to Dublin (eu-west-1) to co-locate with Supabase — avoids transatlantic DB latency.
export const preferredRegion = "dub1";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const { success } = await rateLimit({ key: `push-subscribe:${ip}`, limit: 5, windowMs: 60000 });
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscription } = await request.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    // Scope the subscription to the tenant of the subdomain the PWA is running
    // on (the SW is per-origin, so each school's app gets its own subscription).
    // The user must be an active member there.
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const subdomain = extractSubdomain(host);
    if (!subdomain) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }
    const school = await db.school.findUnique({
      where: { subdomain },
      select: { tenantId: true },
    });
    if (!school) {
      return NextResponse.json({ error: "No tenant" }, { status: 404 });
    }
    const membership = await db.membership.findFirst({
      where: { userId: user.id, tenantId: school.tenantId, status: "ACTIVE" },
      select: { userId: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Upsert subscription (user might re-subscribe from same browser)
    await db.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: user.id,
          endpoint: subscription.endpoint,
        },
      },
      update: {
        tenantId: school.tenantId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        tenantId: school.tenantId,
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("push subscribe failed", { error });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
