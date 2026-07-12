import { describe, it, expect } from "vitest";
import { extractSubdomain, pickSchoolIdByHost } from "@/lib/subdomain";

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

describe("pickSchoolIdByHost", () => {
  const schools = [
    { id: "s-demo", subdomain: "demo" },
    { id: "s-testes", subdomain: "testes" },
    { id: "s-third", subdomain: "third" },
  ];

  it("picks the school matching the current subdomain (multi-school tenant)", () => {
    expect(pickSchoolIdByHost(schools, "testes.convlyx.com")).toBe("s-testes");
    expect(pickSchoolIdByHost(schools, "demo.convlyx.com:443")).toBe("s-demo");
    expect(pickSchoolIdByHost(schools, "third.localhost:3000")).toBe("s-third");
  });

  it("falls back to the sole school for a single-school tenant", () => {
    expect(pickSchoolIdByHost([{ id: "only", subdomain: "acme" }], "acme.convlyx.com")).toBe("only");
    // Even if the host doesn't match, one school is unambiguous.
    expect(pickSchoolIdByHost([{ id: "only", subdomain: "acme" }], "convlyx.com")).toBe("only");
  });

  it("returns '' when multiple schools and none match the host", () => {
    expect(pickSchoolIdByHost(schools, "convlyx.com")).toBe("");
    expect(pickSchoolIdByHost(schools, null)).toBe("");
  });

  it("returns '' for an empty school list", () => {
    expect(pickSchoolIdByHost([], "demo.convlyx.com")).toBe("");
  });
});
