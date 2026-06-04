import { getRequestConfig } from "next-intl/server";
import { cache } from "react";
import { db } from "@/server/db";
import { createClient } from "@/lib/supabase/server";

export const locales = ["pt-PT"] as const;
export const defaultLocale = "pt-PT";

const DEFAULT_TIME_ZONE = "Europe/Lisbon";

/**
 * Resolve the viewing user's school timezone so all next-intl date/time
 * formatting (server components + every client `useFormatter()`) renders in
 * that zone. Cached per request to avoid duplicate lookups across the render.
 * Falls back to Lisbon for unauthenticated/public requests or any error —
 * matches the auth lookup in `createTRPCContext` (src/server/trpc.ts).
 */
const resolveTimeZone = cache(async (): Promise<string> => {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return DEFAULT_TIME_ZONE;

    const user = await db.user.findUnique({
      where: { id: authUser.id },
      select: { school: { select: { timeZone: true } } },
    });
    return user?.school.timeZone ?? DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
});

export default getRequestConfig(async () => {
  const locale = defaultLocale;

  return {
    locale,
    timeZone: await resolveTimeZone(),
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
