export type ParsedSpreadsheet = {
  /** Column headers in sheet order, de-duplicated. */
  headers: string[];
  /** Data rows keyed by header. Empty rows are dropped; cells are trimmed strings. */
  rows: Record<string, string>[];
};

/** Codes map to `students.import.errors.<code>` translation keys. */
export type ParseErrorCode = "parseFailed" | "noHeaders" | "noRows";

export class SpreadsheetParseError extends Error {
  constructor(public readonly code: ParseErrorCode) {
    super(code);
    this.name = "SpreadsheetParseError";
  }
}

/**
 * Parse an uploaded `.xlsx` / `.xls` / `.csv` file into headers + row objects,
 * entirely in the browser. SheetJS is dynamically imported so it never lands in
 * a route bundle (matches the perf convention for heavy click-only libs).
 *
 * Only the first sheet is read. The first non-empty row is treated as headers;
 * duplicate headers are suffixed ("Nome", "Nome (2)") so columns never silently
 * collide. Fully blank rows are discarded.
 */
export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  let aoa: unknown[][];
  try {
    // `xlsx` is CommonJS; depending on the bundler's interop its functions may
    // sit on the namespace or under `.default`. Resolve both so this can't
    // break in the browser bundle while passing under the test runner.
    const imported = await import("xlsx");
    const XLSX = (
      "read" in imported ? imported : (imported as { default: typeof imported }).default
    ) as typeof imported;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new SpreadsheetParseError("noRows");
    const sheet = wb.Sheets[sheetName];
    aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: false,
    });
  } catch (e) {
    if (e instanceof SpreadsheetParseError) throw e;
    // Surface the real cause for debugging — the user only sees the friendly
    // `parseFailed` message, so without this the actual reason (e.g. a missing
    // `xlsx` dependency or a corrupt file) is invisible.
    console.error("parseSpreadsheet failed", e);
    throw new SpreadsheetParseError("parseFailed");
  }

  if (aoa.length === 0) throw new SpreadsheetParseError("noRows");

  // De-duplicate headers so two columns with the same label don't overwrite
  // each other when we build row objects.
  const seen = new Map<string, number>();
  const rawHeaders = aoa[0].map((h) => String(h ?? "").trim());
  const headerKeys = rawHeaders.map((h) => {
    if (h === "") return "";
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h} (${count + 1})`;
  });

  const headers = headerKeys.filter((h) => h !== "");
  if (headers.length === 0) throw new SpreadsheetParseError("noHeaders");

  const rows = aoa
    .slice(1)
    .map((row) => {
      const obj: Record<string, string> = {};
      headerKeys.forEach((key, i) => {
        if (key !== "") obj[key] = String(row[i] ?? "").trim();
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v !== ""));

  if (rows.length === 0) throw new SpreadsheetParseError("noRows");

  return { headers, rows };
}
