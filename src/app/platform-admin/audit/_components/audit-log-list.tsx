"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
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
  if (action.endsWith(".delete")) return "destructive";
  if (action.endsWith(".update")) return "secondary";
  return "outline";
}

export function AuditLogList({
  logs,
  actionOptions,
  actorOptions,
  activeAction,
  activeActor,
}: {
  logs: AuditLog[];
  actionOptions: string[];
  actorOptions: string[];
  activeAction?: string;
  activeActor?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={activeAction ?? "ALL"}
          onValueChange={(v) => updateParam("action", v)}
        >
          <SelectTrigger className="w-auto min-w-[180px]">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as ações</SelectItem>
            {actionOptions.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={activeActor ?? "ALL"}
          onValueChange={(v) => updateParam("actor", v)}
        >
          <SelectTrigger className="w-auto min-w-[220px]">
            <SelectValue placeholder="Autor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os autores</SelectItem>
            {actorOptions.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  {log.targetType}: <span className="text-foreground">{log.targetId}</span>
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
    </div>
  );
}
