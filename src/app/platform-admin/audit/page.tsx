import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { AuditLogList } from "./_components/audit-log-list";

// Cross-tenant live data — never static-render at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string }>;
}) {
  const params = await searchParams;
  const actionFilter = params.action;
  const actorFilter = params.actor;

  const where = {
    ...(actionFilter && { action: actionFilter }),
    ...(actorFilter && { actorEmail: actorFilter }),
  };

  const [logs, total, actions, actors] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
    // Distinct action types and actors for the filter dropdowns. Cheap
    // because the table is small; if it grows we'll need a dedicated index
    // or a cached lookup.
    db.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    db.auditLog.findMany({
      distinct: ["actorEmail"],
      select: { actorEmail: true },
      orderBy: { actorEmail: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/platform-admin" className="inline-flex">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-2xl font-bold mt-2">Registo de auditoria</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ações dos administradores da plataforma. Mostrando até {PAGE_SIZE} entradas mais recentes
            {total > PAGE_SIZE ? ` (${total} no total)` : ""}.
          </p>
        </div>
      </div>

      <AuditLogList
        logs={logs}
        actionOptions={actions.map((a) => a.action)}
        actorOptions={actors.map((a) => a.actorEmail)}
        activeAction={actionFilter}
        activeActor={actorFilter}
      />
    </div>
  );
}
