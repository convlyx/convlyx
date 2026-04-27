"use client";

import { useState } from "react";
import {
  Building2, Users, BookOpen, ClipboardList, Plus, Globe, ExternalLink, UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Tenant = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  _count: { schools: number; users: number };
};

type School = {
  id: string;
  name: string;
  subdomain: string;
  address: string | null;
  phone: string | null;
  tenantId: string;
  tenant: { name: string };
  _count: { users: number; sessions: number };
};

export function PlatformDashboard({
  tenants,
  schools,
  stats,
}: {
  tenants: Tenant[];
  schools: School[];
  stats: { users: number; classes: number; enrollments: number };
}) {
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showCreateSchool, setShowCreateSchool] = useState(false);
  const [createAdminFor, setCreateAdminFor] = useState<School | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [schoolData, setSchoolData] = useState({ name: "", subdomain: "", tenantId: "", address: "", phone: "" });
  const [adminData, setAdminData] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleCreateTenant() {
    setLoading(true);
    const res = await fetch("/api/platform-admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tenantName }),
    });
    if (res.ok) {
      toast.success("Grupo criado com sucesso");
      setShowCreateTenant(false);
      setTenantName("");
      window.location.reload();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Erro ao criar grupo");
    }
    setLoading(false);
  }

  async function handleCreateAdmin() {
    if (!createAdminFor) return;
    setLoading(true);
    const res = await fetch("/api/platform-admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: createAdminFor.id,
        email: adminData.email,
        name: adminData.name,
        phone: adminData.phone,
        password: adminData.password,
      }),
    });
    if (res.ok) {
      toast.success("Admin criado com sucesso");
      setCreateAdminFor(null);
      setAdminData({ name: "", email: "", phone: "", password: "" });
      window.location.reload();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Erro ao criar admin");
    }
    setLoading(false);
  }

  async function handleCreateSchool() {
    setLoading(true);
    const res = await fetch("/api/platform-admin/schools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schoolData),
    });
    if (res.ok) {
      toast.success("Escola criada com sucesso");
      setShowCreateSchool(false);
      setSchoolData({ name: "", subdomain: "", tenantId: "", address: "", phone: "" });
      window.location.reload();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Erro ao criar escola");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Painel de Administração</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão da plataforma Convlyx</p>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={Building2} label="Grupos" value={tenants.length} />
        <StatCard icon={Globe} label="Escolas" value={schools.length} />
        <StatCard icon={Users} label="Utilizadores" value={stats.users} />
        <StatCard icon={BookOpen} label="Aulas" value={stats.classes} />
        <StatCard icon={ClipboardList} label="Inscrições" value={stats.enrollments} />
      </div>

      {/* Tenants */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Grupos</h2>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreateTenant(true)}>
            <Plus className="h-3.5 w-3.5" />
            Criar grupo
          </Button>
        </div>
        <div className="grid gap-3">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="rounded-xl border bg-card p-4 card-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{tenant.name}</p>
                    <Badge variant={tenant.status === "ACTIVE" ? "default" : "destructive"}>
                      {tenant.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tenant._count.schools} escolas · {tenant._count.users} utilizadores
                  </p>
                </div>
                <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{tenant.id.slice(0, 8)}...</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Schools */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Escolas</h2>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreateSchool(true)}>
            <Plus className="h-3.5 w-3.5" />
            Criar escola
          </Button>
        </div>
        <div className="grid gap-3">
          {schools.map((school) => (
            <div key={school.id} className="rounded-xl border bg-card p-4 card-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{school.name}</p>
                      <Badge variant="secondary">{school.tenant.name}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {school.subdomain}.convlyx.com
                      </span>
                      <span>{school._count.users} utilizadores</span>
                      <span>{school._count.sessions} aulas</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setCreateAdminFor(school)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Criar admin
                  </Button>
                  <a
                    href={`https://${school.subdomain}.convlyx.com`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create tenant dialog */}
      <Dialog open={showCreateTenant} onOpenChange={setShowCreateTenant}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar grupo</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Nome do grupo</Label>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Ex: Grupo Escola Lisboa" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTenant(false)}>Cancelar</Button>
            <Button onClick={handleCreateTenant} disabled={loading || !tenantName}>
              {loading ? "A criar..." : "Criar grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create school dialog */}
      <Dialog open={showCreateSchool} onOpenChange={setShowCreateSchool}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar escola</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Grupo</Label>
                <select
                  value={schoolData.tenantId}
                  onChange={(e) => setSchoolData({ ...schoolData, tenantId: e.target.value })}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm cursor-pointer"
                >
                  <option value="">Selecionar grupo...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Nome da escola</Label>
                <Input value={schoolData.name} onChange={(e) => setSchoolData({ ...schoolData, name: e.target.value })} placeholder="Ex: Escola de Condução Lisboa" />
              </div>
              <div className="grid gap-2">
                <Label>Subdomínio</Label>
                <div className="flex items-center gap-1">
                  <Input value={schoolData.subdomain} onChange={(e) => setSchoolData({ ...schoolData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="lisboa" className="flex-1" />
                  <span className="text-sm text-muted-foreground">.convlyx.com</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Morada</Label>
                <Input value={schoolData.address} onChange={(e) => setSchoolData({ ...schoolData, address: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={schoolData.phone} onChange={(e) => setSchoolData({ ...schoolData, phone: e.target.value })} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSchool(false)}>Cancelar</Button>
            <Button onClick={handleCreateSchool} disabled={loading || !schoolData.name || !schoolData.subdomain || !schoolData.tenantId}>
              {loading ? "A criar..." : "Criar escola"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create admin dialog */}
      <Dialog open={createAdminFor !== null} onOpenChange={(o) => { if (!o) setCreateAdminFor(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar admin · {createAdminFor?.name}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <p className="text-xs text-muted-foreground">
                O admin é criado imediatamente, sem email de confirmação. Forneça-lhe a palavra-passe definida aqui.
              </p>
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input value={adminData.name} onChange={(e) => setAdminData({ ...adminData, name: e.target.value })} placeholder="Ex: João Silva" />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={adminData.email} onChange={(e) => setAdminData({ ...adminData, email: e.target.value })} placeholder="admin@escola.pt" />
              </div>
              <div className="grid gap-2">
                <Label>Telefone (opcional)</Label>
                <Input value={adminData.phone} onChange={(e) => setAdminData({ ...adminData, phone: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Palavra-passe (mínimo 8 caracteres)</Label>
                <Input type="password" value={adminData.password} onChange={(e) => setAdminData({ ...adminData, password: e.target.value })} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAdminFor(null)}>Cancelar</Button>
            <Button
              onClick={handleCreateAdmin}
              disabled={loading || !adminData.name || !adminData.email || adminData.password.length < 8}
            >
              {loading ? "A criar..." : "Criar admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 card-shadow">
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
