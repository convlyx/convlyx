import "server-only";
import { cache } from "react";
import { createServerSideHelpers } from "@trpc/react-query/server";
import {
  dehydrate,
  defaultShouldDehydrateQuery,
  type DehydratedState,
} from "@tanstack/react-query";
import superjson from "superjson";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { getDashboardUser } from "@/server/dashboard-user";

/**
 * tRPC server-side helpers for the current request, used by Server Component
 * pages to prefetch queries. The HTML then ships with the data already in the
 * React Query cache, so the client renders it on first paint — no skeleton
 * flash and no extra round-trip after hydration.
 *
 * The tRPC context is built from the cached dashboard user (see
 * `getDashboardUser`), so prefetching adds no extra auth/DB round-trip. Wrapped
 * in `cache()` so repeated calls in one request share a single queryClient —
 * accumulate prefetches, then `dehydrate()` once.
 *
 * `prefetch` never throws, so a failed server-side query degrades gracefully:
 * the page still renders and the client refetches as before.
 */
export const getSsrHelpers = cache(async () => {
  const user = await getDashboardUser();
  const ctx = {
    db,
    tenantId: user?.tenantId ?? null,
    user: user
      ? {
          id: user.id,
          role: user.role,
          tenantId: user.tenantId,
          schoolId: user.schoolId,
        }
      : null,
  };
  return createServerSideHelpers({ router: appRouter, ctx, transformer: superjson });
});

/**
 * Dehydrate prefetched queries for a <HydrationBoundary>. Serializes with
 * superjson to match the client QueryClient's `hydrate.deserializeData` (see
 * `trpc-provider.tsx`) — both sides must use the same transformer or the cache
 * fails to rehydrate and the client refetches.
 */
export function dehydrateSsr(
  helpers: Awaited<ReturnType<typeof getSsrHelpers>>,
): DehydratedState {
  return dehydrate(helpers.queryClient, {
    serializeData: superjson.serialize,
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === "pending",
  });
}
