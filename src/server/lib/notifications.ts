import { after } from "next/server";
import type { DbClient } from "./tenant-scope";
import { sendPushToUsers } from "./push";
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
 * Class times are stored in UTC; this renders them in the class's school
 * wall-clock (`timeZone`), DST-aware. Never use the Date's local getters here
 * — the server runs in UTC on Vercel, so a 10:00 class (09:00 UTC in summer)
 * would otherwise show as 09:00.
 */
export function formatClassTime(startsAt: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
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

export type PushJob = {
  tenantId: string;
  userIds: string[];
  title: string;
  body: string;
  url?: string;
};

type RecordParams = {
  tenantId: string;
  userId: string;
  type: string;
  titleKey: string;
  messageKey: string;
  params?: Record<string, string>;
  pushTitle?: string;
  pushBody?: string;
};

/** Insert ONE notification row via `client` (a tx or db). Returns a PushJob to
 *  dispatch after commit, or null if the user was not found. Sends no push. */
export async function recordNotification(
  client: DbClient,
  p: RecordParams,
): Promise<PushJob | null> {
  // The recipient's school is per-tenant → read it from their Membership in
  // this notification's tenant.
  const member = await client.membership.findFirst({
    where: { tenantId: p.tenantId, userId: p.userId },
    select: { schoolId: true },
  });
  if (!member) return null;

  await client.notification.create({
    data: {
      tenantId: p.tenantId,
      schoolId: member.schoolId,
      userId: p.userId,
      type: p.type,
      title: p.titleKey,
      message: p.messageKey,
      ...(p.params && { data: p.params as object }),
    },
  });

  return {
    tenantId: p.tenantId,
    userIds: [p.userId],
    title: p.pushTitle ?? resolveTranslation(p.titleKey, p.params),
    body: p.pushBody ?? resolveTranslation(p.messageKey, p.params),
    url: "/",
  };
}

/** Insert notification rows for many users via `client`. Returns a PushJob or null. */
export async function recordNotifications(
  client: DbClient,
  p: Omit<RecordParams, "userId"> & { userIds: string[] },
): Promise<PushJob | null> {
  if (p.userIds.length === 0) return null;
  const members = await client.membership.findMany({
    where: { tenantId: p.tenantId, userId: { in: p.userIds } },
    select: { userId: true, schoolId: true },
  });
  const schoolByUserId = new Map(members.map((m) => [m.userId, m.schoolId]));
  const recipients = p.userIds.filter((id) => schoolByUserId.has(id));
  if (recipients.length === 0) return null;

  await client.notification.createMany({
    data: recipients.map((userId) => ({
      tenantId: p.tenantId,
      schoolId: schoolByUserId.get(userId)!,
      userId,
      type: p.type,
      title: p.titleKey,
      message: p.messageKey,
      ...(p.params && { data: p.params as object }),
    })),
  });

  return {
    tenantId: p.tenantId,
    userIds: recipients,
    title: p.pushTitle ?? resolveTranslation(p.titleKey, p.params),
    body: p.pushBody ?? resolveTranslation(p.messageKey, p.params),
    url: "/",
  };
}

/** Fire push for the given jobs as guaranteed background work (runs after the
 *  HTTP response, within the same invocation). Best-effort — never throws. */
export function dispatchPush(db: DbClient, jobs: (PushJob | null)[]): void {
  const real = jobs.filter((j): j is PushJob => j !== null);
  if (real.length === 0) return;
  const run = async () => {
    for (const job of real) {
      try {
        await sendPushToUsers(db, job.tenantId, job.userIds, {
          title: job.title,
          body: job.body,
          url: job.url,
        });
      } catch (e) {
        logger.warn("push dispatch failed", { error: e });
      }
    }
  };
  try {
    // Guaranteed background work after the HTTP response (Fluid Compute keeps
    // the invocation alive to finish it). Requires an active request scope.
    after(run);
  } catch {
    // No request scope — e.g. unit/integration tests calling procedures via a
    // direct tRPC caller. Fall back to a detached best-effort promise (the
    // pre-refactor behavior); push is best-effort either way.
    void run();
  }
}
