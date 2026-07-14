import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { buildAuditWhere } from "@/server/lib/audit-query";
import { AuditLogList } from "./_components/audit-log-list";

// Cross-tenant live data — never static-render at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const RANGE_DAYS = [7, 30, 90] as const;

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; target?: string; days?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) >= 1 ? Number(params.page) : 1;
  const sinceDays = (RANGE_DAYS as ReadonlyArray<number>).includes(Number(params.days))
    ? Number(params.days)
    : undefined;
  const where = buildAuditWhere(
    { action: params.action, actor: params.actor, target: params.target, sinceDays },
    new Date(),
  );

  const [logs, total, actions, actors] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.auditLog.findMany({ distinct: ["actorEmail"], select: { actorEmail: true }, orderBy: { actorEmail: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform-admin" className="inline-flex">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <h1 className="text-2xl font-bold mt-2">Registo de auditoria</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} entradas.</p>
      </div>

      <AuditLogList
        logs={logs}
        actionOptions={actions.map((a) => a.action)}
        actorOptions={actors.map((a) => a.actorEmail)}
        activeAction={params.action}
        activeActor={params.actor}
        activeTarget={params.target ?? ""}
        activeDays={sinceDays ? String(sinceDays) : "ALL"}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}
