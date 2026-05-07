"use client";

import { Calendar, Repeat, Bell, AlertTriangle } from "lucide-react";

/** Hero mockup for /calendario-aulas-conducao — week view with class blocks */
export function CalendarHeroMockup() {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  const hours = ["09", "10", "11", "12", "14"];

  // [day, hour, label, color, span]
  const events: Array<{ day: number; hour: number; label: string; color: string; span?: number }> = [
    { day: 0, hour: 0, label: "Código", color: "bg-blue-400/80", span: 2 },
    { day: 1, hour: 1, label: "Prática", color: "bg-emerald-500/80" },
    { day: 1, hour: 4, label: "Prática", color: "bg-emerald-500/80" },
    { day: 2, hour: 0, label: "Segurança", color: "bg-blue-400/80", span: 2 },
    { day: 2, hour: 3, label: "Prática", color: "bg-emerald-500/80" },
    { day: 3, hour: 2, label: "Prática", color: "bg-emerald-500/80" },
    { day: 4, hour: 1, label: "Código", color: "bg-blue-400/80", span: 2 },
    { day: 4, hour: 4, label: "Prática", color: "bg-emerald-500/80" },
  ];

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-emerald-400/30 rounded-3xl blur-3xl scale-90" />
      <div className="relative rounded-2xl border border-primary/10 bg-card p-5 shadow-xl shadow-primary/5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold">Esta semana</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-medium">Semana</div>
            <div className="px-1.5 py-0.5 rounded text-muted-foreground text-[9px] font-medium">Dia</div>
            <div className="px-1.5 py-0.5 rounded text-muted-foreground text-[9px] font-medium">Mês</div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-[24px_repeat(5,minmax(0,1fr))] gap-1">
          <div />
          {days.map((d) => (
            <div key={d} className="text-[9px] font-semibold text-muted-foreground text-center pb-1 border-b">
              {d}
            </div>
          ))}
          {hours.map((h, hourIdx) => (
            <div key={h} className="contents">
              <div className="text-[8px] text-muted-foreground/70 text-right pr-1 font-mono pt-0.5">{h}h</div>
              {days.map((_, dayIdx) => {
                const ev = events.find((e) => e.day === dayIdx && e.hour === hourIdx);
                if (!ev) return <div key={dayIdx} className="h-5 rounded-sm bg-muted/30" />;
                return (
                  <div
                    key={dayIdx}
                    className={`h-5 rounded-sm ${ev.color} flex items-center justify-center px-1 ${ev.span === 2 ? "row-span-2" : ""}`}
                    style={ev.span === 2 ? { gridRow: `span 2 / span 2`, height: "auto" } : undefined}
                  >
                    <span className="text-[8px] font-semibold text-white truncate">{ev.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-sm bg-blue-400/80" />
            <span className="text-[9px] text-muted-foreground">Teórica</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-sm bg-emerald-500/80" />
            <span className="text-[9px] text-muted-foreground">Prática</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Deep-dive mockup — recurring class form + conflict detection */
export function CalendarDeepDiveMockup() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-tl from-emerald-500/20 to-primary/20 rounded-3xl blur-3xl scale-90" />
      <div className="relative rounded-2xl border border-primary/10 bg-card p-5 shadow-xl shadow-primary/5 space-y-3">
        {/* Form header */}
        <div className="flex items-center gap-2 pb-2 border-b">
          <Repeat className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold">Nova aula recorrente</span>
        </div>

        {/* Form rows */}
        <div className="space-y-2">
          <div>
            <p className="text-[9px] text-muted-foreground mb-0.5">Título</p>
            <div className="rounded-md border bg-muted/30 px-2.5 py-1.5">
              <span className="text-[10px]">Código da Estrada — Turma B</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Início</p>
              <div className="rounded-md border bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] font-mono">09:00</span>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Fim</p>
              <div className="rounded-md border bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] font-mono">10:30</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground mb-0.5">Repetir</p>
            <div className="flex gap-1">
              {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                <div
                  key={i}
                  className={`h-6 w-6 rounded-md flex items-center justify-center text-[9px] font-semibold ${
                    [0, 2, 4].includes(i)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conflict warning */}
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-semibold text-amber-700">Conflito detetado</span>
          </div>
          <p className="text-[9px] text-amber-700/80 leading-snug">
            Instrutor Rui já tem aula prática a 10/05 às 09:00.
          </p>
        </div>

        {/* Notification preview */}
        <div className="rounded-lg bg-primary/5 border border-primary/15 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <Bell className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-primary">12 alunos serão notificados</span>
          </div>
          <p className="text-[9px] text-muted-foreground leading-snug">
            Lembrete na véspera + alteração de horário.
          </p>
        </div>
      </div>
    </div>
  );
}
