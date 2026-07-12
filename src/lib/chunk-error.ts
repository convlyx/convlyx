/**
 * A ChunkLoadError almost always means the browser is running an old build
 * whose chunk filenames a new deploy has since renamed — so the lazy chunk it
 * asks for 404s. The fix is a single full reload onto the fresh build. This
 * module detects that class of error and triggers one guarded reload.
 */

const RELOAD_FLAG = "convlyx:chunk-reload-at";
// If a reload doesn't fix it (e.g. a genuinely missing/blocked asset), don't
// loop — only reload again after this cooldown.
const RELOAD_COOLDOWN_MS = 15_000;

/** True for the "stale chunk after deploy" family of errors (webpack/turbopack
 *  chunk loads + native dynamic-import failures). */
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: unknown; message?: unknown };
  const name = typeof e.name === "string" ? e.name : "";
  const msg = typeof e.message === "string" ? e.message : "";
  return (
    name === "ChunkLoadError" ||
    /loading( css)? chunk [\w-]+ failed/i.test(msg) ||
    /failed to (load|fetch) .*(chunk|dynamically imported module)/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg)
  );
}

/**
 * Force ONE full reload onto the current build. Returns true if a reload was
 * triggered. Guarded via sessionStorage so a persistent failure doesn't loop.
 */
export function reloadForChunkError(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? "0");
    if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) {
      return false; // already reloaded recently — avoid a loop
    }
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // sessionStorage unavailable (some private modes) — still reload once.
  }
  window.location.reload();
  return true;
}
