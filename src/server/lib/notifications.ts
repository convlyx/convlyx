import type { PrismaClient } from "@/generated/prisma/client";
import { sendPushToUser, sendPushToUsers } from "./push";

/** Format a date for notification params: "20/04 às 09:00" */
export function formatClassTime(startsAt: Date): string {
  const day = String(startsAt.getDate()).padStart(2, "0");
  const month = String(startsAt.getMonth() + 1).padStart(2, "0");
  const hours = String(startsAt.getHours()).padStart(2, "0");
  const mins = String(startsAt.getMinutes()).padStart(2, "0");
  return `${day}/${month} às ${hours}:${mins}`;
}

type CreateNotificationParams = {
  db: PrismaClient;
  tenantId: string;
  userId: string;
  type: string;
  titleKey: string;
  messageKey: string;
  params?: Record<string, string>;
  /** Plain-text title for push notification (OS-rendered, not i18n) */
  pushTitle?: string;
  /** Plain-text body for push notification */
  pushBody?: string;
};

/**
 * Create a notification for a user.
 * Stores translation keys + params, NOT pre-rendered text.
 * The client renders the translated text via next-intl.
 */
export async function createNotification({
  db,
  tenantId,
  userId,
  type,
  titleKey,
  messageKey,
  params,
  pushTitle,
  pushBody,
}: CreateNotificationParams) {
  try {
    const result = await db.notification.create({
      data: {
        tenantId,
        userId,
        type,
        title: titleKey,
        message: messageKey,
        ...(params && { data: params as object }),
      },
    });

    // Also send push notification if text provided
    if (pushTitle || pushBody) {
      sendPushToUser(db, userId, {
        title: pushTitle ?? "Convlyx",
        body: pushBody ?? "",
        url: "/",
      }).catch(() => {});
    }

    return result;
  } catch (error) {
    console.error("[Notification] Failed to create:", error);
    throw error;
  }
}

export async function createNotifications({
  db,
  tenantId,
  userIds,
  type,
  titleKey,
  messageKey,
  params,
  pushTitle,
  pushBody,
}: Omit<CreateNotificationParams, "userId"> & { userIds: string[] }) {
  if (userIds.length === 0) return;
  try {
    const result = await db.notification.createMany({
      data: userIds.map((userId) => ({
        tenantId,
        userId,
        type,
        title: titleKey,
        message: messageKey,
        ...(params && { data: params as object }),
      })),
    });

    // Also send push notifications
    if (pushTitle || pushBody) {
      sendPushToUsers(db, userIds, {
        title: pushTitle ?? "Convlyx",
        body: pushBody ?? "",
        url: "/",
      }).catch(() => {});
    }

    return result;
  } catch (error) {
    console.error("[Notification] Failed to create many:", error);
    throw error;
  }
}
