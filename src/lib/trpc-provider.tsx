"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchStreamLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "./trpc";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cached results are considered fresh for 30s — covers normal
            // navigation between pages without refetching. Mutations
            // continue to invalidate explicitly so post-edit freshness
            // is unchanged.
            staleTime: 30 * 1000,
            // Tab focus no longer triggers a refetch storm. Views that
            // need live data (e.g. the calendar) can override per-query
            // with `refetchOnWindowFocus: true`.
            refetchOnWindowFocus: false,
            // Default smart behaviour: refetch only if the data is stale,
            // not on every mount. Was "always" — that meant remounting
            // a page (which happens on every navigation back) hit the
            // server again even if the cache was fresh.
            refetchOnMount: true,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        // httpBatchStreamLink keeps batching (1 HTTP request per tick) but
        // streams each procedure's response as soon as the server resolves
        // it — so sections fed by independent queries can render
        // progressively instead of all blocking on the slowest.
        httpBatchStreamLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
