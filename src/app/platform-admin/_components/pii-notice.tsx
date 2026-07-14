import { ShieldAlert } from "lucide-react";

export function PiiNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p>A visualização de dados pessoais de alunos fica registada no registo de auditoria (quem, quando, qual grupo).</p>
    </div>
  );
}
