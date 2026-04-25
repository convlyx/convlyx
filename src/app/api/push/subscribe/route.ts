import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const { success } = rateLimit({ key: `push-subscribe:${ip}`, limit: 5, windowMs: 60000 });
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

    // Upsert subscription (user might re-subscribe from same browser)
    await db.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: user.id,
          endpoint: subscription.endpoint,
        },
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push Subscribe]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
