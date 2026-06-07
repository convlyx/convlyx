"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { buildEmailCounts, isImportable, type WorkingRow } from "./row-validation";
import {
  useBulkImport, type WizardStep,
} from "./use-bulk-import";
import { UploadStep } from "./upload-step";
import { MappingStep } from "./mapping-step";
import { PreviewStep } from "./preview-step";
import { ResultsStep } from "./results-step";

const STEP_ORDER: WizardStep[] = ["upload", "mapping", "preview", "results"];

export function BulkImportDialog({ buttonLabel }: { buttonLabel?: string } = {}) {
  const t = useTranslations("students.import");
  const { onError } = useTranslatedError();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const bulk = useBulkImport();

  const { data: schools } = trpc.school.list.useQuery(undefined, { enabled: open });

  // Auto-select the only school (mirrors the single-create dialog).
  useEffect(() => {
    if (open && !bulk.schoolId && schools?.length === 1) {
      bulk.setSchoolId(schools[0].id);
    }
  }, [open, schools, bulk]);

  const bulkCreate = trpc.user.bulkCreate.useMutation({
    onSuccess: (data) => {
      bulk.setResults(data.results);
      bulk.setStep("results");
      utils.user.list.invalidate();
    },
    onError,
  });

  // Flag rows whose email already exists in the tenant. Runs on entering the
  // preview and (debounced) whenever an email cell changes. Keyed on emails
  // only, so re-applying the `existing` flag doesn't retrigger the effect.
  const emailsKey = useMemo(
    () => bulk.rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean).join(","),
    [bulk.rows],
  );
  useEffect(() => {
    if (bulk.step !== "preview") return;
    const emails = emailsKey.split(",").filter(Boolean);
    if (emails.length === 0) return;
    const handle = setTimeout(async () => {
      try {
        const { existing } = await utils.user.checkExistingEmails.fetch({ emails });
        bulk.applyExisting(existing);
      } catch {
        // Advisory only — the server still skips/reactivates correctly on import.
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailsKey, bulk.step]);

  function close() {
    setOpen(false);
    bulk.reset();
    bulkCreate.reset();
  }

  function handleSubmit() {
    const counts = buildEmailCounts(bulk.rows);
    const students = bulk.rows
      .filter((row: WorkingRow) => isImportable(row, counts))
      .map((row) => ({
        name: row.name.trim(),
        email: row.email.trim(),
        phone: row.phone.trim() || undefined,
        category: row.category as Exclude<WorkingRow["category"], "">,
      }));
    if (students.length === 0) return;
    bulkCreate.mutate({ schoolId: bulk.schoolId, students });
  }

  const label = buttonLabel ?? t("button");
  const currentIndex = STEP_ORDER.indexOf(bulk.step);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog
        open={open}
        onOpenChange={(val) => {
          if (!val) close();
          else setOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <ol className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {STEP_ORDER.map((s, i) => (
                <li
                  key={s}
                  className={`inline-flex items-center gap-1 ${
                    i === currentIndex ? "font-medium text-foreground" : ""
                  }`}
                >
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      i <= currentIndex ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {t(`steps.${s}`)}
                  {i < STEP_ORDER.length - 1 && <span className="ml-1">›</span>}
                </li>
              ))}
            </ol>
          </DialogHeader>
          <DialogBody>
            {bulk.step === "upload" && <UploadStep onParsed={bulk.onParsed} />}

            {bulk.step === "mapping" && bulk.parsed && (
              <MappingStep
                headers={bulk.parsed.headers}
                mapping={bulk.mapping}
                onFieldMapping={bulk.setFieldMapping}
                schools={schools}
                schoolId={bulk.schoolId}
                onSchoolId={bulk.setSchoolId}
                defaultCategory={bulk.defaultCategory}
                onDefaultCategory={bulk.setDefaultCategory}
                onContinue={bulk.buildRows}
              />
            )}

            {bulk.step === "preview" && (
              <PreviewStep
                rows={bulk.rows}
                rowErrors={bulk.rowErrors}
                importableCount={bulk.importableCount}
                onUpdateRow={bulk.updateRow}
                onRemoveRow={bulk.removeRow}
                onBack={() => bulk.setStep("mapping")}
                onSubmit={handleSubmit}
                submitting={bulkCreate.isPending}
              />
            )}

            {bulk.step === "results" && (
              <ResultsStep
                results={bulk.results}
                onImportAnother={() => {
                  bulk.reset();
                  bulkCreate.reset();
                }}
                onDone={close}
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
