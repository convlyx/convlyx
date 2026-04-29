"use client";

import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
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
  if (typeof window === "undefined" || !initialized) return;
  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
    role: user.role,
    tenant_id: user.tenantId,
    school_id: user.schoolId,
  });
  if (user.tenantId) {
    posthog.group("tenant", user.tenantId);
  }
  if (user.schoolId) {
    posthog.group("school", user.schoolId);
  }
}

/** Track a custom event. */
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined" || !initialized) return;
  posthog.capture(event, properties);
}

/** Reset on logout to clear user identity. */
export function resetAnalytics() {
  if (typeof window === "undefined" || !initialized) return;
  posthog.reset();
}

export { posthog };
