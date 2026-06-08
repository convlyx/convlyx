import { describe, it, expect } from "vitest";
import {
  generateSecret,
  currentToken,
  verifyToken,
  CHECKIN_WINDOW_MS,
} from "./checkin-token";

const SESSION = "11111111-1111-1111-1111-111111111111";

describe("checkin-token", () => {
  it("generates a non-empty hex secret", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[0-9a-f]+$/);
    expect(s.length).toBe(64);
  });

  it("accepts a token within the current window", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    const token = currentToken(secret, SESSION, now);
    expect(verifyToken(secret, SESSION, token, now)).toBe(true);
  });

  it("accepts a token from a recent (tolerated) past window", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    const token = currentToken(secret, SESSION, now);
    expect(verifyToken(secret, SESSION, token, now + CHECKIN_WINDOW_MS * 2)).toBe(true);
  });

  it("rejects a token older than the tolerance", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    const token = currentToken(secret, SESSION, now);
    expect(verifyToken(secret, SESSION, token, now + CHECKIN_WINDOW_MS * 10)).toBe(false);
  });

  it("rejects a forged token", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    expect(verifyToken(secret, SESSION, "deadbeef", now)).toBe(false);
  });

  it("rejects a token signed for a different session", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    const token = currentToken(secret, "22222222-2222-2222-2222-222222222222", now);
    expect(verifyToken(secret, SESSION, token, now)).toBe(false);
  });

  it("rejects empty or non-hex input without throwing", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    expect(verifyToken(secret, SESSION, "", now)).toBe(false);
    expect(verifyToken(secret, SESSION, "xyz!@#$", now)).toBe(false);
  });
});
