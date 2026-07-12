import { describe, it, expect } from "vitest";
import { isChunkLoadError } from "@/lib/chunk-error";

describe("isChunkLoadError", () => {
  it("matches webpack/next ChunkLoadError by name", () => {
    const e = new Error("Loading chunk 4823 failed.");
    e.name = "ChunkLoadError";
    expect(isChunkLoadError(e)).toBe(true);
  });

  it("matches by message for the common failure phrasings", () => {
    expect(isChunkLoadError({ message: "Loading chunk 12cwiiefi7ojc failed" })).toBe(true);
    expect(isChunkLoadError({ message: "Loading CSS chunk 91 failed" })).toBe(true);
    expect(
      isChunkLoadError({ message: "Failed to fetch dynamically imported module: https://x/a.js" }),
    ).toBe(true);
    expect(
      isChunkLoadError({ message: "error loading dynamically imported module" }),
    ).toBe(true);
    expect(isChunkLoadError({ message: "importing a module script failed." })).toBe(true);
  });

  it("does NOT match unrelated errors", () => {
    expect(isChunkLoadError(new Error("TypeError: x is not a function"))).toBe(false);
    expect(isChunkLoadError({ message: "Network request failed" })).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError("some string")).toBe(false);
  });
});
