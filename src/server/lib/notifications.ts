import type { PrismaClient } from "@/generated/prisma/client";

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
  /** Translation key for the title, e.g. "notifications.classWasCancelled" */
  titleKey: string;
  /** Translation key for the message, e.g. "notifications.classCancelled" */
  messageKey: string;
  /** Params for the message template, e.g. { title: "Aula Prática", time: "20/04 às 09:00" } */
  params?: Record<string, string>;
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
}: CreateNotificationParams) {
  try {
    return await db.notification.create({
      data: {
        tenantId,
        userId,
        type,
        title: titleKey,
        message: messageKey,
        ...(params && { data: params as object }),
      },
    });
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
}: Omit<CreateNotificationParams, "userId"> & { userIds: string[] }) {
  if (userIds.length === 0) return;
  try {
    return await db.notification.createMany({
      data: userIds.map((userId) => ({
        tenantId,
        userId,
        type,
        title: titleKey,
        message: messageKey,
        ...(params && { data: params as object }),
      })),
    });
  } catch (error) {
    console.error("[Notification] Failed to create many:", error);
    throw error;
  }
}
