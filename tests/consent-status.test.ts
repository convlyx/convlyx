import { describe, it, expect } from "vitest";
import { userTermsSatisfied, controllerDpaSatisfied } from "@/lib/consent";
import { LEGAL_VERSIONS } from "@/lib/legal";

describe("consent version logic", () => {
  it("userTerms: null record is not satisfied", () => {
    expect(userTermsSatisfied(null)).toBe(false);
  });
  it("userTerms: matching terms+privacy is satisfied", () => {
    expect(
      userTermsSatisfied({ terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy }),
    ).toBe(true);
  });
  it("userTerms: stale terms is not satisfied", () => {
    expect(
      userTermsSatisfied({ terms: "1999-01-01", privacy: LEGAL_VERSIONS.privacy }),
    ).toBe(false);
  });
  it("controllerDpa: matching terms+dpa is satisfied", () => {
    expect(
      controllerDpaSatisfied({ terms: LEGAL_VERSIONS.terms, dpa: LEGAL_VERSIONS.dpa }),
    ).toBe(true);
  });
  it("controllerDpa: stale dpa is not satisfied", () => {
    expect(
      controllerDpaSatisfied({ terms: LEGAL_VERSIONS.terms, dpa: "1999-01-01" }),
    ).toBe(false);
  });
});
