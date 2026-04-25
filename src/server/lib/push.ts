import webpush from "web-push";
import type { PrismaClient } from "@/generated/prisma/client";

// Configure web-push with VAPID keys
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "convlyx@gmail.com"}`,
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

/**
 * Send push notification to a user.
 * Looks up all their push subscriptions and sends to each.
 * Silently removes expired/invalid subscriptions.
 */
export async function sendPushToUser(
  db: PrismaClient,
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log("[Push] VAPID keys not configured, skipping");
    return;
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  console.log(`[Push] Sending to ${subscriptions.length} subscription(s) for user ${userId}`);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      console.log(`[Push] Sent successfully to ${sub.endpoint.slice(0, 50)}...`);
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      console.error(`[Push] Failed: status=${statusCode}`, (error as Error)?.message);
      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
}

/**
 * Send push notification to multiple users.
 */
export async function sendPushToUsers(
  db: PrismaClient,
  userIds: string[],
  payload: { title: string; body: string; url?: string }
) {
  await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(db, userId, payload))
  );
}
