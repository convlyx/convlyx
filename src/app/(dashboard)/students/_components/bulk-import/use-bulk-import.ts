"use client";

import { useCallback, useMemo, useState } from "react";
import type { LicenseCategory } from "@/lib/license-categories";
import { autoDetectColumns, parseCategory, type ImportField } from "./column-detect";
import type { ParsedSpreadsheet } from "./parse-spreadsheet";
import {
  buildEmailCounts,
  countImportable,
  validateRow,
  type RowErrorCode,
  type WorkingRow,
} from "./row-validation";

export type WizardStep = "upload" | "mapping" | "preview" | "results";

export type ColumnMapping = Record<ImportField, string | null>;

export type ImportResult = {
  email: string;
  status: "created" | "reactivated" | "skipped" | "failed";
  reason?: string;
};

function makeId(): string {
  return crypto.randomUUID();
}

export function useBulkImport() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: null,
    email: null,
    phone: null,
    category: null,
  });
  const [schoolId, setSchoolId] = useState("");
  const [defaultCategory, setDefaultCategory] = useState<LicenseCategory | "">("");
  const [rows, setRows] = useState<WorkingRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);

  /** File parsed → pre-fill the mapping and advance to the mapping step. */
  const onParsed = useCallback((data: ParsedSpreadsheet, name: string) => {
    setParsed(data);
    setFileName(name);
    setMapping(autoDetectColumns(data.headers));
    setStep("mapping");
  }, []);

  const setFieldMapping = useCallback((field: ImportField, header: string | null) => {
    setMapping((prev) => ({ ...prev, [field]: header }));
  }, []);

  /**
   * Build the editable working rows from the parsed data + current mapping.
   * Category per row: a recognized value in the mapped category column wins;
   * otherwise the batch default fills it. Then advance to the preview.
   */
  const buildRows = useCallback(() => {
    if (!parsed) return;
    const built: WorkingRow[] = parsed.rows.map((raw) => {
      const mappedCategory = mapping.category ? parseCategory(raw[mapping.category]) : null;
      return {
        id: makeId(),
        name: mapping.name ? raw[mapping.name] ?? "" : "",
        email: mapping.email ? raw[mapping.email] ?? "" : "",
        phone: mapping.phone ? raw[mapping.phone] ?? "" : "",
        category: mappedCategory ?? defaultCategory,
      };
    });
    setRows(built);
    setStep("preview");
  }, [parsed, mapping, defaultCategory]);

  const updateRow = useCallback((id: string, patch: Partial<WorkingRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  /** Merge existing-email statuses (from the server) onto the matching rows. */
  const applyExisting = useCallback(
    (existing: Array<{ email: string; status: "ACTIVE" | "INACTIVE" }>) => {
      const byEmail = new Map(existing.map((e) => [e.email.toLowerCase(), e.status]));
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          existing: byEmail.get(row.email.trim().toLowerCase()),
        })),
      );
    },
    [],
  );

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setParsed(null);
    setMapping({ name: null, email: null, phone: null, category: null });
    setSchoolId("");
    setDefaultCategory("");
    setRows([]);
    setResults([]);
  }, []);

  // Derived validation state — recomputed whenever rows change.
  const emailCounts = useMemo(() => buildEmailCounts(rows), [rows]);
  const rowErrors = useMemo(() => {
    const map = new Map<string, RowErrorCode[]>();
    for (const row of rows) map.set(row.id, validateRow(row, emailCounts));
    return map;
  }, [rows, emailCounts]);
  const importableCount = useMemo(() => countImportable(rows), [rows]);

  return {
    step,
    setStep,
    fileName,
    parsed,
    mapping,
    setFieldMapping,
    schoolId,
    setSchoolId,
    defaultCategory,
    setDefaultCategory,
    rows,
    results,
    setResults,
    onParsed,
    buildRows,
    updateRow,
    removeRow,
    applyExisting,
    reset,
    emailCounts,
    rowErrors,
    importableCount,
  };
}
