import "server-only";
import { cache } from "react";
import { createServerSideHelpers } from "@trpc/react-query/server";
import superjson from "superjson";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { createClient } from "@/lib/supabase/server";
import type { TRPCContext } from "@/server/trpc";

/**
 * SSR helpers for platform-admin pages. Builds an admin tRPC context (userEmail
 * from Supabase; no tenant). Pair with `dehydrateSsr` from `@/server/ssr`.
 *
 * Wrapped in `cache()` so repeated prefetches in one request share a single
 * queryClient — accumulate prefetches, then `dehydrate()` once.
 */
export const getAdminSsrHelpers = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ctx: TRPCContext = {
    db,
    tenantId: null,
    ip: null,
    user: user ? { id: user.id } : null,
    userEmail: user?.email ?? null,
    loadMembership: async () => null,
  };
  return createServerSideHelpers({ router: appRouter, ctx, transformer: superjson });
});
