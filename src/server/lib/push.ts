import webpush from "web-push";
import type { PrismaClient } from "@/generated/prisma/client";

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "convlyx@gmail.com"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
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
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return; // Push not configured
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
    } catch (error: unknown) {
      // Remove expired/invalid subscriptions
      const statusCode = (error as { statusCode?: number })?.statusCode;
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
