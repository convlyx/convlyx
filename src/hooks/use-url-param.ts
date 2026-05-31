"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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

/**
 * Debounced, URL-synced string state for search inputs.
 *
 * Unlike `useUrlParam`, the input must NOT be bound directly to the URL: each
 * keystroke would fire a `router.replace`, and Next defers/throttles those soft
 * navigations, so `useSearchParams` lags behind the DOM. A controlled input
 * bound to that lagging value gets reset on fast typing and drops characters.
 *
 * This hook keeps a local state that drives the input instantly, and debounces
 * the write to the URL. The URL stays the single source of truth for the
 * *committed* value (shareable links, hydration, back/forward).
 *
 * Returns `[inputValue, committedValue, setValue]`:
 * - `inputValue` — bind to `<Input value=>`; updates on every keystroke.
 * - `committedValue` — debounced; use for queries and page-reset effects.
 * - `setValue` — call from `onChange`.
 */
export function useDebouncedUrlParam(
  key: string,
  defaultValue: string,
  delayMs = 300,
): [string, string, (next: string) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlValue = searchParams.get(key) ?? defaultValue;

  // Local state drives the input immediately; seeded from the URL.
  const [localValue, setLocalValue] = useState(urlValue);

  // Remember the value we last wrote so we can tell our own debounced URL
  // updates apart from external ones (back/forward, programmatic reset).
  const lastWritten = useRef(urlValue);

  // Adopt URL changes that didn't originate from this input.
  useEffect(() => {
    if (urlValue !== lastWritten.current) {
      lastWritten.current = urlValue;
      setLocalValue(urlValue);
    }
  }, [urlValue]);

  // Debounce the local value into the URL.
  useEffect(() => {
    if (localValue === urlValue) return;
    const id = setTimeout(() => {
      lastWritten.current = localValue;
      const params = new URLSearchParams(window.location.search);
      if (localValue === defaultValue) params.delete(key);
      else params.set(key, localValue);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, delayMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue, delayMs, key, defaultValue, pathname]);

  return [localValue, urlValue, setLocalValue];
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
