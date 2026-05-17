"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * URL-synced state with default-value elision.
 *
 * Reading is derived from the URL on every render (no separate React state),
 * so direct navigation to a URL with the param already set hydrates the
 * component correctly. Writing updates the URL via `router.replace` with
 * `scroll: false`, then re-renders re-derive the value.
 *
 * When the new value matches `defaultValue`, the param is removed from the
 * URL — keeps shareable links clean (`/students` instead of `/students?status=ACTIVE&view=cards`).
 *
 * Caveat: each `setValue` triggers a `router.replace`. For very high-frequency
 * updates (e.g. a search input firing on every keystroke) this is the same
 * cost as the manual `useState + router.replace` pattern this replaces, but
 * debounce at the call site if it ever becomes a perf concern.
 */
export function useUrlParam<T extends string>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = (searchParams.get(key) as T | null) ?? defaultValue;

  const setValue = useCallback(
    (next: T) => {
      // Read latest URL state from `window` rather than the React snapshot —
      // back-to-back setters in the same handler would otherwise build their
      // params from a stale `searchParams` and clobber each other.
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [key, defaultValue, router, pathname],
  );

  return [value, setValue];
}

/** Numeric variant of `useUrlParam` — handles the `page` case across list pages. */
export function useUrlParamInt(
  key: string,
  defaultValue: number,
): [number, (next: number) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const raw = searchParams.get(key);
  const parsed = raw == null ? defaultValue : Number(raw);
  const value = Number.isFinite(parsed) && parsed >= 1 ? parsed : defaultValue;

  const setValue = useCallback(
    (next: number) => {
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue) params.delete(key);
      else params.set(key, String(next));
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [key, defaultValue, router, pathname],
  );

  return [value, setValue];
}
