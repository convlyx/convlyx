"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";

type SchoolConfig = {
  id: string;
  name: string;
  config: { cancellationNoticeHours: number; practicalSelfEnrollEnabled: boolean };
};

export function EditSchoolDialog({ tenantId, school }: { tenantId: string; school: SchoolConfig }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(school.name);
  const [notice, setNotice] = useState(String(school.config.cancellationNoticeHours));
  const [selfEnroll, setSelfEnroll] = useState(school.config.practicalSelfEnrollEnabled);

  const update = trpc.admin.ops.updateSchool.useMutation({
    onSuccess: () => {
      toast.success("Escola atualizada");
      setOpen(false);
      utils.admin.account.get.invalidate({ tenantId });
    },
    onError: () => toast.error("Erro ao atualizar escola"),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Editar</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar escola</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="es-name">Nome</Label>
                <Input id="es-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="es-notice">Aviso de cancelamento (horas)</Label>
                <Input id="es-notice" type="number" min={0} max={168} value={notice} onChange={(e) => setNotice(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={selfEnroll} onCheckedChange={(v) => setSelfEnroll(v === true)} />
                Auto-inscrição prática
              </label>
              <p className="text-xs text-muted-foreground">O fuso horário não é editável — altera a conversão de horas históricas.</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => update.mutate({
                schoolId: school.id,
                name,
                cancellationNoticeHours: Number(notice) || 0,
                practicalSelfEnrollEnabled: selfEnroll,
              })}
              disabled={update.isPending || !name.trim()}
            >
              {update.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
