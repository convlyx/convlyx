import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all push subscriptions for this user
    await db.pushSubscription.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push Unsubscribe]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
