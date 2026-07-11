import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/csrf";
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

    // Look up tenant so push sends can scope by tenant — guards against a
    // user being moved across tenants and still receiving pushes from the
    // old one.
    const profile = await db.user.findUnique({
      where: { id: user.id },
      select: { tenantId: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
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
        tenantId: profile.tenantId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        tenantId: profile.tenantId,
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
