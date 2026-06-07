import { describe, expect, test } from "vitest";
import {
  buildEmailCounts,
  countImportable,
  isImportable,
  validateRow,
  type WorkingRow,
} from "@/app/(dashboard)/students/_components/bulk-import/row-validation";

let seq = 0;
function row(partial: Partial<WorkingRow>): WorkingRow {
  return {
    id: `row-${seq++}`,
    name: "Ana",
    email: "ana@test.pt",
    phone: "",
    category: "B",
    ...partial,
  };
}

describe("validateRow", () => {
  test("valid row has no errors", () => {
    const r = row({});
    expect(validateRow(r, buildEmailCounts([r]))).toEqual([]);
  });

  test("flags missing name", () => {
    const r = row({ name: "   " });
    expect(validateRow(r, buildEmailCounts([r]))).toContain("nameRequired");
  });

  test("flags invalid email", () => {
    const r = row({ email: "not-an-email" });
    expect(validateRow(r, buildEmailCounts([r]))).toContain("emailInvalid");
  });

  test("flags missing/invalid category", () => {
    const r = row({ category: "" });
    expect(validateRow(r, buildEmailCounts([r]))).toContain("categoryRequired");
  });

  test("flags in-file duplicate emails", () => {
    const rows = [row({ email: "dup@test.pt" }), row({ email: "DUP@test.pt" })];
    const counts = buildEmailCounts(rows);
    expect(validateRow(rows[0], counts)).toContain("emailDuplicate");
    expect(validateRow(rows[1], counts)).toContain("emailDuplicate");
  });
});

describe("isImportable / countImportable", () => {
  test("excludes already-ACTIVE rows even if otherwise valid", () => {
    const r = row({ existing: "ACTIVE" });
    expect(isImportable(r, buildEmailCounts([r]))).toBe(false);
  });

  test("includes INACTIVE rows (server reactivates them)", () => {
    const r = row({ existing: "INACTIVE" });
    expect(isImportable(r, buildEmailCounts([r]))).toBe(true);
  });

  test("counts only importable rows", () => {
    const rows = [
      row({ email: "a@test.pt" }),               // valid
      row({ email: "b@test.pt", name: "" }),      // invalid name
      row({ email: "c@test.pt", existing: "ACTIVE" }), // active → excluded
      row({ email: "d@test.pt", existing: "INACTIVE" }), // valid reactivation
    ];
    expect(countImportable(rows)).toBe(2);
  });
});
