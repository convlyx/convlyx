import webpush from "web-push";
import type { DbClient } from "./tenant-scope";
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
  db: DbClient,
  tenantId: string,
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const subscriptions = await db.pushSubscription.findMany({
    where: { tenantId, userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const MAX_PUSH_ATTEMPTS = 3;

  for (const sub of subscriptions) {
    for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        break; // delivered
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } })
            .catch((e) => logger.warn("push subscription cleanup failed", { error: e, subscriptionId: sub.id }));
          break; // dead subscription — do not retry
        }
        if (attempt === MAX_PUSH_ATTEMPTS) {
          logger.warn("push send failed after retries", { error, subscriptionId: sub.id, attempts: attempt });
          break;
        }
        await new Promise((r) => setTimeout(r, attempt * 500)); // backoff: 500ms, 1000ms
      }
    }
  }
}

/**
 * Send push notification to multiple users in the same tenant.
 */
export async function sendPushToUsers(
  db: DbClient,
  tenantId: string,
  userIds: string[],
  payload: { title: string; body: string; url?: string }
) {
  await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(db, tenantId, userId, payload))
  );
}
