"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";

export function TenantActions({
  tenantId,
  tenantName,
  status,
}: {
  tenantId: string;
  tenantName: string;
  status: "ACTIVE" | "INACTIVE";
}) {
  const utils = trpc.useUtils();
  const [renameOpen, setRenameOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [name, setName] = useState(tenantName);
  const [confirmName, setConfirmName] = useState("");

  const invalidate = () => {
    utils.admin.account.get.invalidate({ tenantId });
    utils.admin.portfolio.overview.invalidate();
    utils.admin.portfolio.kpis.invalidate();
  };

  const suspend = trpc.admin.ops.suspendTenant.useMutation({
    onSuccess: () => { toast.success("Grupo suspenso"); setSuspendOpen(false); setConfirmName(""); invalidate(); },
    onError: () => toast.error("Erro ao suspender"),
  });
  const reactivate = trpc.admin.ops.reactivateTenant.useMutation({
    onSuccess: () => { toast.success("Grupo reativado"); invalidate(); },
    onError: () => toast.error("Erro ao reativar"),
  });
  const rename = trpc.admin.ops.renameTenant.useMutation({
    onSuccess: () => { toast.success("Grupo renomeado"); setRenameOpen(false); invalidate(); },
    onError: () => toast.error("Erro ao renomear"),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => { setName(tenantName); setRenameOpen(true); }}>
        Renomear
      </Button>
      {status === "ACTIVE" ? (
        <Button variant="outline" size="sm" className="text-destructive" onClick={() => setSuspendOpen(true)}>
          Suspender
        </Button>
      ) : (
        <Button size="sm" onClick={() => reactivate.mutate({ tenantId })} disabled={reactivate.isPending}>
          Reativar
        </Button>
      )}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear grupo</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="grid gap-2">
              <Label htmlFor="ta-name">Nome</Label>
              <Input id="ta-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button onClick={() => rename.mutate({ tenantId, name })} disabled={rename.isPending || !name.trim()}>
              {rename.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend confirm-by-name dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suspender grupo</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Suspender bloqueia o acesso de todos os utilizadores deste grupo. Escreva
              <span className="font-medium text-foreground"> {tenantName} </span>
              para confirmar.
            </p>
            <Input className="mt-3" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label="Confirmar nome do grupo" />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancelar</Button>
            <Button
              className="text-destructive"
              variant="outline"
              onClick={() => suspend.mutate({ tenantId })}
              disabled={suspend.isPending || confirmName !== tenantName}
            >
              {suspend.isPending ? "A suspender…" : "Suspender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
