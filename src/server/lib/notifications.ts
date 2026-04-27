import type { PrismaClient } from "@/generated/prisma/client";
import { sendPushToUser, sendPushToUsers } from "./push";
import messages from "@/../messages/pt-PT.json";

/**
 * Resolve a translation key like "notifications.classAssigned" to PT-PT text,
 * interpolating {param} placeholders.
 */
function resolveTranslation(key: string, params?: Record<string, string>): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = messages;
  for (const part of parts) {
    value = value?.[part];
  }
  if (typeof value !== "string") return key;
  if (!params) return value;
  return Object.entries(params).reduce(
    (text, [k, v]) => text.replace(new RegExp(`\\{${k}\\}`, "g"), v),
    value,
  );
}

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

    // Send push notification (resolve text from translation keys if not provided)
    sendPushToUser(db, userId, {
      title: pushTitle ?? resolveTranslation(titleKey, params),
      body: pushBody ?? resolveTranslation(messageKey, params),
      url: "/",
    }).catch(() => {});

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

    // Send push notifications (resolve text from translation keys if not provided)
    sendPushToUsers(db, userIds, {
      title: pushTitle ?? resolveTranslation(titleKey, params),
      body: pushBody ?? resolveTranslation(messageKey, params),
      url: "/",
    }).catch(() => {});

    return result;
  } catch (error) {
    console.error("[Notification] Failed to create many:", error);
    throw error;
  }
}
