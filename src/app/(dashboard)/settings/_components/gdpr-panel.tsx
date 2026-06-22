"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, FileDown } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { downloadJson } from "@/lib/download-json";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const MIN_SEARCH_CHARS = 1;

/**
 * Compliance-only panel. Admin types part of a name/email, picks the right
 * user, and downloads everything we hold about them as JSON. Per-user
 * detail pages intentionally don't expose this — it's a rare action and
 * lives only here to keep it discoverable without cluttering common flows.
 */
export function GdprPanel() {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  // Debounce the server query so typing doesn't fire a request per keystroke;
  // the input stays bound to `search` so it remains instant.
  const trimmed = useDebouncedValue(search.trim());
  const enabled = trimmed.length >= MIN_SEARCH_CHARS;

  const { data, isFetching } = trpc.user.list.useQuery(
    { search: trimmed, page: 1, pageSize: 10 },
    { enabled },
  );

  async function handleExport(id: string) {
    try {
      const dump = await utils.user.exportData.fetch({ id });
      const safeName = dump.profile.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
      downloadJson(`dados-${safeName}-${new Date().toISOString().slice(0, 10)}`, dump);
      toast.success(t("toast.dataExported"));
    } catch (e) {
      onError(e as { message: string });
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("settings.gdprTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.gdprIntro")}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("settings.gdprSearchPlaceholder")}
          aria-label={t("settings.gdprSearchPlaceholder")}
          className="pl-9"
        />
      </div>

      <div aria-live="polite" aria-busy={enabled && isFetching}>
      {!enabled ? null : isFetching ? (
        <Loading />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Search} message={t("settings.gdprNoResults")} />
      ) : (
        <div className="space-y-1">
          {data.items.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => handleExport(user.id)}
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("users.exportData")}
              </Button>
            </div>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}
