import { describe, it, expect } from "vitest";
import { extractSubdomain } from "@/lib/subdomain";

describe("extractSubdomain", () => {
  it("extracts the first label of a production tenant host", () => {
    expect(extractSubdomain("demo.convlyx.com")).toBe("demo");
    expect(extractSubdomain("escola-x.convlyx.com")).toBe("escola-x");
  });

  it("strips a port", () => {
    expect(extractSubdomain("demo.convlyx.com:443")).toBe("demo");
    expect(extractSubdomain("demo.localhost:3000")).toBe("demo");
  });

  it("is case-insensitive", () => {
    expect(extractSubdomain("Demo.Convlyx.COM")).toBe("demo");
  });

  it("handles local dev hosts", () => {
    expect(extractSubdomain("demo.localhost")).toBe("demo");
    expect(extractSubdomain("localhost")).toBeNull();
    expect(extractSubdomain("localhost:3000")).toBeNull();
    expect(extractSubdomain("127.0.0.1")).toBeNull();
    expect(extractSubdomain("127.0.0.1:3000")).toBeNull();
  });

  it("returns null for the apex domain and bare hosts", () => {
    expect(extractSubdomain("convlyx.com")).toBeNull();
    expect(extractSubdomain("convlyx.com:443")).toBeNull();
  });

  it("returns null for Vercel preview hosts", () => {
    expect(extractSubdomain("my-app-git-branch.vercel.app")).toBeNull();
  });

  it("returns null/empty for missing input", () => {
    expect(extractSubdomain(null)).toBeNull();
    expect(extractSubdomain(undefined)).toBeNull();
    expect(extractSubdomain("")).toBeNull();
  });

  it("returns reserved labels as-is (callers filter them)", () => {
    expect(extractSubdomain("admin.convlyx.com")).toBe("admin");
    expect(extractSubdomain("www.convlyx.com")).toBe("www");
  });
});
