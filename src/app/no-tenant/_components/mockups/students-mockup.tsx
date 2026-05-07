"use client";

import { Check, X, Calendar, Award, Clock } from "lucide-react";

/** Hero mockup for /gestao-alunos-conducao — student profile card */
export function StudentsHeroMockup() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-emerald-400/30 rounded-3xl blur-3xl scale-90" />
      <div className="relative rounded-2xl border border-primary/10 bg-card p-5 shadow-xl shadow-primary/5 space-y-3">
        {/* Profile header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-white">JM</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Joana Martins</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-mono font-semibold">
                Categoria B
              </span>
              <span className="text-[10px] text-muted-foreground">Inscrita há 4 meses</span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
            <p className="text-base font-bold text-emerald-700">28</p>
            <p className="text-[8px] text-muted-foreground">Aulas</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-center">
            <p className="text-base font-bold text-primary">94%</p>
            <p className="text-[8px] text-muted-foreground">Assiduidade</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 p-2 text-center">
            <p className="text-base font-bold text-blue-700">12</p>
            <p className="text-[8px] text-muted-foreground">Práticas</p>
          </div>
        </div>

        {/* Attendance bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold">Progresso até exame prático</span>
            <span className="text-[10px] font-mono text-primary font-semibold">75%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-3/4 bg-gradient-to-r from-primary to-emerald-500 rounded-full" />
          </div>
        </div>

        {/* Recent attendance */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Últimas aulas</p>
          {[
            { date: "12/05", title: "Código da Estrada", present: true },
            { date: "10/05", title: "Aula prática · Cidade", present: true },
            { date: "08/05", title: "Sinalização", present: false },
            { date: "05/05", title: "Aula prática · Auto-estrada", present: true },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
              <span className="text-[9px] font-mono text-muted-foreground w-8">{c.date}</span>
              <span className="text-[10px] font-medium flex-1 truncate">{c.title}</span>
              {c.present ? (
                <div className="h-3.5 w-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="h-2 w-2 text-emerald-600" />
                </div>
              ) : (
                <div className="h-3.5 w-3.5 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <X className="h-2 w-2 text-rose-600" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Deep-dive mockup — student list with progress + IMT exam status */
export function StudentsDeepDiveMockup() {
  const students = [
    { name: "Joana Martins", cat: "B", progress: 92, status: "ready", initials: "JM" },
    { name: "Tiago Ferreira", cat: "A", progress: 64, status: "active", initials: "TF" },
    { name: "Rita Sousa", cat: "B", progress: 100, status: "passed", initials: "RS" },
    { name: "Miguel Lopes", cat: "C", progress: 38, status: "active", initials: "ML" },
    { name: "Inês Costa", cat: "B", progress: 78, status: "active", initials: "IC" },
  ];

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-tl from-emerald-500/20 to-primary/20 rounded-3xl blur-3xl scale-90" />
      <div className="relative rounded-2xl border border-primary/10 bg-card p-5 shadow-xl shadow-primary/5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b">
          <span className="text-[11px] font-semibold">Alunos da escola</span>
          <span className="text-[10px] text-muted-foreground">5 de 48</span>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-medium">Todos</div>
          <div className="px-2 py-0.5 rounded-md bg-muted/60 text-foreground/70 text-[9px] font-medium">Categoria B</div>
          <div className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 text-[9px] font-medium">Pronto p/ exame</div>
          <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 text-[9px] font-medium">Aprovados</div>
        </div>

        {/* Students list */}
        <div className="space-y-1.5">
          {students.map((s) => (
            <div key={s.name} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/80 to-emerald-500/80 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">{s.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold truncate">{s.name}</span>
                  <span className="px-1 py-0.5 rounded bg-background text-foreground/70 text-[8px] font-mono font-semibold border">
                    {s.cat}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full"
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
              </div>
              {s.status === "passed" && (
                <div className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 flex items-center gap-1">
                  <Award className="h-2.5 w-2.5 text-emerald-700" />
                  <span className="text-[8px] font-semibold text-emerald-700">Aprovado</span>
                </div>
              )}
              {s.status === "ready" && (
                <div className="px-1.5 py-0.5 rounded-md bg-amber-500/15 flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5 text-amber-700" />
                  <span className="text-[8px] font-semibold text-amber-700">Exame</span>
                </div>
              )}
              {s.status === "active" && (
                <div className="px-1.5 py-0.5 rounded-md bg-blue-500/15 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5 text-blue-700" />
                  <span className="text-[8px] font-semibold text-blue-700">Ativo</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
