import webpush from "web-push";
import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

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
 * Looks up their push subscriptions in the given tenant and sends to each.
 * Silently removes expired/invalid subscriptions.
 *
 * The `tenantId` filter guards against a user being moved across tenants and
 * still receiving pushes from the old one (subscriptions are tenant-scoped).
 */
export async function sendPushToUser(
  db: PrismaClient,
  tenantId: string,
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const subscriptions = await db.pushSubscription.findMany({
    where: { tenantId, userId },
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
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription.delete({ where: { id: sub.id } })
          .catch((e) => logger.warn("push subscription cleanup failed", { error: e, subscriptionId: sub.id }));
      }
    }
  }
}

/**
 * Send push notification to multiple users in the same tenant.
 */
export async function sendPushToUsers(
  db: PrismaClient,
  tenantId: string,
  userIds: string[],
  payload: { title: string; body: string; url?: string }
) {
  await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(db, tenantId, userId, payload))
  );
}
