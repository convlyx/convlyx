import { describe, expect, test } from "vitest";
import {
  autoDetectColumns,
  parseCategory,
} from "@/app/(dashboard)/students/_components/bulk-import/column-detect";

describe("autoDetectColumns", () => {
  test("matches PT-PT headers exactly", () => {
    const m = autoDetectColumns(["Nome", "Email", "Telemóvel", "Categoria"]);
    expect(m).toEqual({
      name: "Nome",
      email: "Email",
      phone: "Telemóvel",
      category: "Categoria",
    });
  });

  test("is case- and accent-insensitive", () => {
    const m = autoDetectColumns(["NOME COMPLETO", "E-MAIL", "telemovel"]);
    expect(m.name).toBe("NOME COMPLETO");
    expect(m.email).toBe("E-MAIL");
    expect(m.phone).toBe("telemovel");
    expect(m.category).toBeNull();
  });

  test("matches English fallback headers", () => {
    const m = autoDetectColumns(["Name", "Email", "Phone", "Category"]);
    expect(m.name).toBe("Name");
    expect(m.email).toBe("Email");
    expect(m.phone).toBe("Phone");
    expect(m.category).toBe("Category");
  });

  test("falls back to substring match for verbose headers", () => {
    const m = autoDetectColumns(["Nome do aluno", "Endereço de email", "Telemóvel do aluno"]);
    expect(m.name).toBe("Nome do aluno");
    expect(m.email).toBe("Endereço de email");
    expect(m.phone).toBe("Telemóvel do aluno");
  });

  test("leaves unmatched fields null", () => {
    const m = autoDetectColumns(["Coluna A", "Coluna B"]);
    expect(m).toEqual({ name: null, email: null, phone: null, category: null });
  });

  test("never assigns the same column to two fields", () => {
    // "mail" matches email; ensure it isn't also claimed elsewhere.
    const m = autoDetectColumns(["mail"]);
    const assigned = Object.values(m).filter(Boolean);
    expect(new Set(assigned).size).toBe(assigned.length);
  });
});

describe("parseCategory", () => {
  test("accepts exact categories", () => {
    expect(parseCategory("B")).toBe("B");
    expect(parseCategory("A1")).toBe("A1");
    expect(parseCategory("C1E")).toBe("C1E");
  });

  test("is case-insensitive and trims", () => {
    expect(parseCategory(" b ")).toBe("B");
    expect(parseCategory("a2")).toBe("A2");
  });

  test("extracts a category from a labelled value", () => {
    expect(parseCategory("Categoria B")).toBe("B");
    expect(parseCategory("Carta B")).toBe("B");
  });

  test("prefers the longer category token (C1E over C)", () => {
    expect(parseCategory("Carta C1E")).toBe("C1E");
  });

  test("returns null for unknown or empty values", () => {
    expect(parseCategory("")).toBeNull();
    expect(parseCategory(undefined)).toBeNull();
    expect(parseCategory("Z9")).toBeNull();
  });
});
