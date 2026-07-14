"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { ClipboardList } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";

type AuditLog = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: Date;
};

// Tint each action class differently so an operator can scan the list.
function actionVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.endsWith(".create")) return "default";
  if (action.endsWith(".delete") || action.endsWith(".suspend")) return "destructive";
  if (action.endsWith(".update") || action.endsWith(".view_detail") || action.endsWith(".list_view")) return "secondary";
  return "outline";
}

export function AuditLogList({
  logs,
  actionOptions,
  actorOptions,
  activeAction,
  activeActor,
  activeTarget,
  activeDays,
  page,
  pageSize,
  total,
}: {
  logs: AuditLog[];
  actionOptions: string[];
  actorOptions: string[];
  activeAction?: string;
  activeActor?: string;
  activeTarget: string;
  activeDays: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL" || value === "") params.delete(key);
    else params.set(key, value);
    if (resetPage) params.delete("page");
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={activeAction ?? "ALL"} onValueChange={(v) => setParam("action", v)}>
          <SelectTrigger className="w-auto min-w-[180px]"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as ações</SelectItem>
            {actionOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={activeActor ?? "ALL"} onValueChange={(v) => setParam("actor", v)}>
          <SelectTrigger className="w-auto min-w-[220px]"><SelectValue placeholder="Autor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os autores</SelectItem>
            {actorOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={activeDays} onValueChange={(v) => setParam("days", v)}>
          <SelectTrigger className="w-auto min-w-[140px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sempre</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Input
          defaultValue={activeTarget}
          placeholder="Filtrar por ID de alvo…"
          className="w-[280px]"
          aria-label="Filtrar por ID de alvo"
          onKeyDown={(e) => { if (e.key === "Enter") setParam("target", (e.target as HTMLInputElement).value.trim()); }}
        />
        {activeTarget && (
          <Button variant="ghost" size="sm" onClick={() => setParam("target", "")}>Limpar alvo</Button>
        )}
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ClipboardList} message="Sem registos." />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="p-4 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
                  <span className="text-xs text-muted-foreground">{log.actorEmail}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(log.createdAt).toLocaleString("pt-PT", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </span>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  {log.targetType}:{" "}
                  <button
                    type="button"
                    className="text-foreground hover:underline"
                    onClick={() => setParam("target", log.targetId)}
                    title="Filtrar por este alvo"
                  >
                    {log.targetId}
                  </button>
                </div>
                {log.metadata != null && (
                  <pre className="text-xs bg-muted/40 rounded px-2 py-1.5 overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(total / pageSize)}
        total={total}
        pageSize={pageSize}
        onPageChange={(p) => setParam("page", String(p), false)}
      />
    </div>
  );
}
