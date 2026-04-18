"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";

type Student = {
  id: string;
  name: string;
  email: string;
};

export function StudentPicker({
  students,
  selected,
  onChange,
  max = 2,
}: {
  students: Student[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const [search, setSearch] = useState("");

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStudents = students.filter((s) => selected.includes(s.id));

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < max) {
      onChange([...selected, id]);
    }
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selectedStudents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedStudents.map((student) => (
            <span
              key={student.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium"
            >
              {student.name}
              <button
                type="button"
                onClick={() => remove(student.id)}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input with floating dropdown */}
      {selected.length < max && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Pesquisar aluno..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => setTimeout(() => setSearch(""), 150)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Floating results */}
          {search.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border bg-popover shadow-md divide-y">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2 text-center">Sem resultados</p>
              ) : (
                filtered.slice(0, 10).map((student) => {
                  const isSelected = selected.includes(student.id);
                  return (
                    <button
                      key={student.id}
                      type="button"
                      disabled={isSelected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { toggle(student.id); setSearch(""); }}
                      className="flex items-center gap-2.5 w-full px-2.5 py-2 text-left hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserAvatar name={student.name} className="h-7 w-7 bg-primary/10 text-primary text-[10px]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{student.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{student.email}</p>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] text-primary font-medium">Selecionado</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selected.length}/{max} {max === 1 ? "aluno selecionado" : "alunos selecionados"}
      </p>
    </div>
  );
}
