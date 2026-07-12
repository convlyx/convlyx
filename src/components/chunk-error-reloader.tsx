"use client";

import { useEffect } from "react";
import { isChunkLoadError, reloadForChunkError } from "@/lib/chunk-error";

/**
 * Catches "stale chunk after deploy" failures that surface OUTSIDE React's
 * render path — a lazy `import()` rejecting (unhandledrejection) or a chunk
 * `<script>` failing to load (error event) during client navigation — and
 * reloads onto the fresh build. React-render chunk errors are handled by the
 * error boundaries (error.tsx / global-error.tsx). Renders nothing.
 */
export function ChunkErrorReloader() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isChunkLoadError(e.error) || isChunkLoadError({ message: e.message })) {
        reloadForChunkError();
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkLoadError(e.reason)) reloadForChunkError();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
