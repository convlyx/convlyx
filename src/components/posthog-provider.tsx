"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, posthog } from "@/lib/posthog";

/**
 * PostHog is split into two leaf components so it never wraps `children`.
 *
 * The previous shape — `<PostHogProvider>{children}</PostHogProvider>` — used
 * `useSearchParams` and triggered Next.js's prerender bailout for the entire
 * subtree, including the marketing pages. That meant `LandingPage` shipped as
 * a JS payload instead of server-rendered HTML, hurting AEO (most AI
 * crawlers don't execute JS).
 *
 * `PostHogInit` initializes PostHog once on mount and uses no dynamic APIs.
 * `PostHogPageviews` captures pageview events on route change; it's the only
 * component that calls `useSearchParams`, so it must be wrapped in Suspense
 * by the caller — but it has no children, so the bailout doesn't propagate.
 */

export function PostHogInit() {
  useEffect(() => {
    initPostHog();
  }, []);
  return null;
}

export function PostHogPageviews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (!pathname) return;
    const url =
      window.location.origin +
      pathname +
      (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
