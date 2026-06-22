"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadCloud, FileSpreadsheet, Info } from "lucide-react";
import { parseSpreadsheet, SpreadsheetParseError } from "./parse-spreadsheet";
import type { ParsedSpreadsheet } from "./parse-spreadsheet";

type Props = {
  onParsed: (data: ParsedSpreadsheet, fileName: string) => void;
};

export function UploadStep({ onParsed }: Props) {
  const t = useTranslations("students.import");
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setParsing(true);
    try {
      const parsed = await parseSpreadsheet(file);
      onParsed(parsed, file.name);
    } catch (e) {
      const code = e instanceof SpreadsheetParseError ? e.code : "parseFailed";
      setError(t(`errors.${code}`));
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t("upload.title")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t("upload.hint")}</p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        disabled={parsing}
        aria-label={t("upload.dropzone")}
        aria-busy={parsing}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors disabled:opacity-60 ${
          dragging ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
        }`}
      >
        {parsing ? (
          <>
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground animate-pulse" />
            <span className="text-sm text-muted-foreground">{t("upload.parsing")}</span>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">{t("upload.dropzone")}</span>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        aria-label={t("upload.dropzone")}
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          // Reset so re-selecting the same file fires onChange again.
          e.target.value = "";
        }}
      />

      {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}

      <div className="flex gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">{t("upload.infoTitle")}</p>
          <p>{t("upload.info")}</p>
        </div>
      </div>
    </div>
  );
}
