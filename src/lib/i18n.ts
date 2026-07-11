import { getRequestConfig } from "next-intl/server";
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { extractSubdomain } from "@/lib/subdomain";

export const locales = ["pt-PT"] as const;
export const defaultLocale = "pt-PT";

const DEFAULT_TIME_ZONE = "Europe/Lisbon";

/**
 * Resolve the current school's timezone so all next-intl date/time formatting
 * (server components + every client `useFormatter()`) renders in that zone.
 * Timezone is a property of the school (i.e. the subdomain), identical for
 * every viewer, so it's resolved from the subdomain — no auth lookup needed.
 * Cached per request. Falls back to Lisbon for public/apex requests or errors.
 */
const resolveTimeZone = cache(async (): Promise<string> => {
  try {
    const headersList = await headers();
    const subdomain =
      headersList.get("x-tenant-subdomain") ??
      extractSubdomain(headersList.get("x-forwarded-host") ?? headersList.get("host"));
    if (!subdomain) return DEFAULT_TIME_ZONE;

    const school = await db.school.findUnique({
      where: { subdomain },
      select: { timeZone: true },
    });
    return school?.timeZone ?? DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
});

export default getRequestConfig(async () => {
  const locale = defaultLocale;

  return {
    locale,
    timeZone: await resolveTimeZone(),
    // Shared per-request "now" so relative-time rendering (e.g. the student
    // dashboard countdown) is identical on the server and on client hydration.
    // Inherited by NextIntlClientProvider since it's rendered from a Server
    // Component. Without this, `new Date()` differs between SSR and hydration
    // and triggers React #418 text-content mismatches.
    now: new Date(),
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
