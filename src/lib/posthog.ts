"use client";

// posthog-js (~75KB gzip) is loaded lazily via dynamic import so it never sits
// in the dashboard page bundle or competes with first paint. Calls made before
// the library finishes loading are queued and flushed once it's ready.

type PostHogClient = (typeof import("posthog-js"))["default"];

let instance: PostHogClient | null = null;
let loadPromise: Promise<PostHogClient | null> | null = null;
const queue: Array<(ph: PostHogClient) => void> = [];

function loadPostHog(): Promise<PostHogClient | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (instance) return Promise.resolve(instance);
  if (loadPromise) return loadPromise;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return Promise.resolve(null);

  loadPromise = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
      persistence: "localStorage+cookie",
    });
    instance = posthog;
    // Flush anything queued before the library finished loading, in order.
    for (const fn of queue.splice(0)) fn(posthog);
    return posthog;
  });
  return loadPromise;
}

/** Run a call against posthog, loading it lazily and queueing until ready. */
function withPostHog(fn: (ph: PostHogClient) => void) {
  if (instance) {
    fn(instance);
    return;
  }
  // Don't queue (and never flush) when analytics is disabled or off-browser.
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  queue.push(fn);
  void loadPostHog();
}

/** Kick off the lazy load. Callers defer this to idle time. */
export function initPostHog() {
  void loadPostHog();
}

/** Identify the current user so events are linked to their profile. */
export function identifyUser(user: {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  tenantId?: string;
  schoolId?: string;
}) {
  withPostHog((posthog) => {
    posthog.identify(user.id, {
      email: user.email,
      name: user.name,
      role: user.role,
      tenant_id: user.tenantId,
      school_id: user.schoolId,
    });
    if (user.tenantId) posthog.group("tenant", user.tenantId);
    if (user.schoolId) posthog.group("school", user.schoolId);
  });
}

/** Track a custom event. */
export function track(event: string, properties?: Record<string, unknown>) {
  withPostHog((posthog) => posthog.capture(event, properties));
}

/** Capture a pageview — called on route change. */
export function capturePageview(url: string) {
  withPostHog((posthog) => posthog.capture("$pageview", { $current_url: url }));
}

/** Reset on logout to clear user identity. Won't force a load if posthog
 * never initialized (nothing to reset). */
export function resetAnalytics() {
  if (instance) instance.reset();
}
