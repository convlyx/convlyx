"use client";

import { CalendarDays, Users, BookOpen, Check, Bell } from "lucide-react";

/** Hero mockup for /software-escola-conducao — multi-panel "control center" view */
export function SoftwareHeroMockup() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-emerald-400/30 rounded-3xl blur-3xl scale-90" />
      <div className="absolute -inset-1 bg-gradient-to-br from-primary/10 to-emerald-400/10 rounded-2xl" />
      <div className="relative rounded-2xl border border-primary/10 bg-card p-5 shadow-xl shadow-primary/5 space-y-3">
        {/* Window chrome */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary/60" />
            <div className="h-2 w-24 rounded bg-muted" />
          </div>
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-muted" />
            <div className="h-2 w-2 rounded-full bg-muted" />
            <div className="h-2 w-2 rounded-full bg-muted" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-3 space-y-1">
            <CalendarDays className="h-4 w-4 text-primary" />
            <p className="text-lg font-bold">12</p>
            <p className="text-[9px] text-muted-foreground">Aulas hoje</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-3 space-y-1">
            <Users className="h-4 w-4 text-emerald-500" />
            <p className="text-lg font-bold">48</p>
            <p className="text-[9px] text-muted-foreground">Alunos ativos</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-3 space-y-1">
            <Check className="h-4 w-4 text-blue-500" />
            <p className="text-lg font-bold">94%</p>
            <p className="text-[9px] text-muted-foreground">Assiduidade</p>
          </div>
        </div>

        {/* Sections — calendar list + side panel */}
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-3 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Próximas aulas</p>
            {[
              { color: "bg-blue-400", title: "Código da Estrada", time: "09:00", students: "14/20" },
              { color: "bg-emerald-500", title: "Aula Prática", time: "10:30", students: "1/1" },
              { color: "bg-blue-400", title: "Segurança Rodoviária", time: "14:00", students: "18/20" },
            ].map((cls, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
                <div className={`h-2 w-2 rounded-full ${cls.color}`} />
                <span className="text-[10px] font-medium flex-1 truncate">{cls.title}</span>
                <span className="text-[9px] text-muted-foreground">{cls.time}</span>
              </div>
            ))}
          </div>
          <div className="col-span-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Alertas</p>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Bell className="h-2.5 w-2.5 text-amber-600" />
                <span className="text-[9px] font-semibold text-amber-700">Exame IMT</span>
              </div>
              <p className="text-[8px] text-amber-600/80 leading-tight">3 alunos prontos para exame prático</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-2.5 w-2.5 text-blue-600" />
                <span className="text-[9px] font-semibold text-blue-700">Teóricas</span>
              </div>
              <p className="text-[8px] text-blue-600/80 leading-tight">2 turmas com vagas livres</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Deep-dive mockup — "today's overview" with role-based panels */
export function SoftwareDeepDiveMockup() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-tl from-emerald-500/20 to-primary/20 rounded-3xl blur-3xl scale-90" />
      <div className="relative rounded-2xl border border-primary/10 bg-card p-5 shadow-xl shadow-primary/5 space-y-3">
        {/* Tab strip */}
        <div className="flex items-center gap-1 border-b pb-2">
          {["Admin", "Secretariado", "Instrutor", "Aluno"].map((role, i) => (
            <div
              key={role}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium ${
                i === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              {role}
            </div>
          ))}
        </div>

        {/* Multi-tenant selector pill */}
        <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary/5 to-emerald-500/5 border border-primary/10 px-3 py-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">EC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold">Escola de Condução Lisboa</p>
            <p className="text-[8px] text-muted-foreground font-mono">lisboa.convlyx.com</p>
          </div>
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        {/* Categories of license */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">Categorias IMT</p>
          <div className="flex flex-wrap gap-1.5">
            {["AM", "A1", "A2", "A", "B1", "B", "BE", "C1", "C", "D1", "D"].map((cat) => (
              <div
                key={cat}
                className="px-2 py-1 rounded-md bg-muted/60 text-[10px] font-mono font-semibold text-foreground/70"
              >
                {cat}
              </div>
            ))}
          </div>
        </div>

        {/* Mini progress rows */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Progresso da turma</p>
          {[
            { name: "Joana M.", cat: "B", progress: 85 },
            { name: "Tiago F.", cat: "A", progress: 60 },
            { name: "Rita S.", cat: "B", progress: 40 },
          ].map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-semibold text-primary">{s.name[0]}</span>
              </div>
              <span className="text-[10px] font-medium w-16 truncate">{s.name}</span>
              <span className="text-[9px] font-mono text-muted-foreground w-4">{s.cat}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full"
                  style={{ width: `${s.progress}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground w-7 text-right">{s.progress}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
