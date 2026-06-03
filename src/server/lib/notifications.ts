import type { DbClient } from "./tenant-scope";
import { sendPushToUser, sendPushToUsers } from "./push";
import { logger } from "@/lib/logger";
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

  // Resolve enum-like params to translated values (e.g. status: "ATTENDED" → "presente")
  const resolvedParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === "status" && v === "ATTENDED") {
      resolvedParams[k] = resolveTranslation("notifications.statusAttended");
    } else if (k === "status" && v === "NO_SHOW") {
      resolvedParams[k] = resolveTranslation("notifications.statusNoShow");
    } else {
      resolvedParams[k] = v;
    }
  }

  return Object.entries(resolvedParams).reduce(
    (text, [k, v]) => text.replace(new RegExp(`\\{${k}\\}`, "g"), v),
    value,
  );
}

/**
 * Format a date for notification params: "20/04 às 09:00".
 *
 * Class times are stored in UTC; this renders them in Portugal wall-clock
 * (Europe/Lisbon), DST-aware. Never use the Date's local getters here — the
 * server runs in UTC on Vercel, so a 10:00 Lisbon class (09:00 UTC in summer)
 * would otherwise show as 09:00.
 */
export function formatClassTime(startsAt: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(startsAt);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hourCycle h23 via hour12:false; guard "24" → "00" just in case.
  const hours = get("hour") === "24" ? "00" : get("hour");
  return `${get("day")}/${get("month")} às ${hours}:${get("minute")}`;
}

type CreateNotificationParams = {
  db: DbClient;
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
 *
 * The recipient's `schoolId` is derived from their User row so callers
 * don't have to plumb it through.
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
    const user = await db.user.findFirst({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (!user) return null;

    const result = await db.notification.create({
      data: {
        tenantId,
        schoolId: user.schoolId,
        userId,
        type,
        title: titleKey,
        message: messageKey,
        ...(params && { data: params as object }),
      },
    });

    // Send push notification (resolve text from translation keys if not provided)
    sendPushToUser(db, tenantId, userId, {
      title: pushTitle ?? resolveTranslation(titleKey, params),
      body: pushBody ?? resolveTranslation(messageKey, params),
      url: "/",
    }).catch((e) => logger.warn("push send failed", { error: e, kind: "sendPushToUser" }));

    return result;
  } catch (error) {
    logger.error("notification create failed", { error });
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
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, schoolId: true },
    });
    const schoolByUserId = new Map(users.map((u) => [u.id, u.schoolId]));

    const result = await db.notification.createMany({
      data: userIds
        .filter((userId) => schoolByUserId.has(userId))
        .map((userId) => ({
          tenantId,
          schoolId: schoolByUserId.get(userId)!,
          userId,
          type,
          title: titleKey,
          message: messageKey,
          ...(params && { data: params as object }),
        })),
    });

    // Send push notifications (resolve text from translation keys if not provided)
    sendPushToUsers(db, tenantId, userIds, {
      title: pushTitle ?? resolveTranslation(titleKey, params),
      body: pushBody ?? resolveTranslation(messageKey, params),
      url: "/",
    }).catch((e) => logger.warn("push send failed", { error: e, kind: "sendPushToUsers" }));

    return result;
  } catch (error) {
    logger.error("notification createMany failed", { error });
    throw error;
  }
}
