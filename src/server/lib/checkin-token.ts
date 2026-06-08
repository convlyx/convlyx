import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** QR token rotation window. ~20s keeps a shared screenshot stale quickly. */
export const CHECKIN_WINDOW_MS = 20_000;
/** Past windows still accepted, to cover scan→tap delay (~80s back). */
const TOLERANCE_WINDOWS = 4;

export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

function windowIndex(nowMs: number): number {
  return Math.floor(nowMs / CHECKIN_WINDOW_MS);
}

function sign(secret: string, sessionId: string, index: number): string {
  return createHmac("sha256", secret)
    .update(`${sessionId}:${index}`)
    .digest("hex")
    .slice(0, 16);
}

export function currentToken(secret: string, sessionId: string, nowMs: number): string {
  return sign(secret, sessionId, windowIndex(nowMs));
}

export function verifyToken(
  secret: string,
  sessionId: string,
  token: string,
  nowMs: number,
): boolean {
  if (!token || !/^[0-9a-f]{16}$/.test(token)) return false;
  const current = windowIndex(nowMs);
  for (let i = 0; i <= TOLERANCE_WINDOWS; i++) {
    const expected = sign(secret, sessionId, current - i);
    if (
      expected.length === token.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(token))
    ) {
      return true;
    }
  }
  return false;
}
