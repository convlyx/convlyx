"use client";

import { useEffect, useState } from "react";

/**
 * Returns a copy of `value` that only updates after it has stopped changing
 * for `delayMs`. Use to throttle work driven by fast-changing state — e.g. a
 * server query bound to a search input — while keeping the input itself
 * controlled by the immediate value.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
