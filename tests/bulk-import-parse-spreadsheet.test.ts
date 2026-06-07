import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import {
  parseSpreadsheet,
  SpreadsheetParseError,
} from "@/app/(dashboard)/students/_components/bulk-import/parse-spreadsheet";

/** Build a File from an array-of-arrays sheet so we can exercise the parser. */
function makeFile(aoa: unknown[][], name = "alunos.xlsx"): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], name);
}

describe("parseSpreadsheet", () => {
  test("parses headers + rows", async () => {
    const file = makeFile([
      ["Nome", "Email", "Telemóvel"],
      ["Ana", "ana@test.pt", "910000000"],
      ["Bruno", "bruno@test.pt", "920000000"],
    ]);
    const { headers, rows } = await parseSpreadsheet(file);
    expect(headers).toEqual(["Nome", "Email", "Telemóvel"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Nome: "Ana", Email: "ana@test.pt", "Telemóvel": "910000000" });
  });

  test("drops fully blank rows", async () => {
    const file = makeFile([
      ["Nome", "Email"],
      ["Ana", "ana@test.pt"],
      ["", ""],
      ["Bruno", "bruno@test.pt"],
    ]);
    const { rows } = await parseSpreadsheet(file);
    expect(rows).toHaveLength(2);
  });

  test("de-duplicates repeated headers", async () => {
    const file = makeFile([
      ["Nome", "Nome"],
      ["Ana", "Silva"],
    ]);
    const { headers, rows } = await parseSpreadsheet(file);
    expect(headers).toEqual(["Nome", "Nome (2)"]);
    expect(rows[0]).toEqual({ Nome: "Ana", "Nome (2)": "Silva" });
  });

  test("trims cell values", async () => {
    const file = makeFile([
      ["Nome"],
      ["  Ana  "],
    ]);
    const { rows } = await parseSpreadsheet(file);
    expect(rows[0].Nome).toBe("Ana");
  });

  test("throws noRows when only headers are present", async () => {
    const file = makeFile([["Nome", "Email"]]);
    await expect(parseSpreadsheet(file)).rejects.toBeInstanceOf(SpreadsheetParseError);
    await expect(parseSpreadsheet(file)).rejects.toMatchObject({ code: "noRows" });
  });
});
