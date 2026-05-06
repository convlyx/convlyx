import type { Metadata } from "next";
import { SeoLanding } from "@/app/no-tenant/_components/seo-landing";

const URL = "https://convlyx.com/calendario-aulas-conducao";
const TITLE = "Calendário e agenda de aulas de condução | Convlyx";
const DESCRIPTION =
  "Agenda inteligente para escolas de condução: aulas teóricas e práticas num só calendário, deteção de conflitos de horário, recorrência automática e notificações para alunos e instrutores. Convlyx, o software para escolas de condução em Portugal.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: "website",
    url: URL,
    siteName: "Convlyx",
    title: TITLE,
    description: DESCRIPTION,
    locale: "pt_PT",
    images: ["https://convlyx.com/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["https://convlyx.com/og-image.png"],
  },
};

export default function Page() {
  return (
    <SeoLanding
      kicker="Calendário e agenda de aulas de condução"
      title="A agenda da sua escola de condução,"
      highlight="sempre organizada."
      intro="O calendário do Convlyx mostra todas as aulas teóricas e práticas num só sítio, deteta conflitos de horário automaticamente e envia notificações a alunos e instrutores em tempo real."
      bullets={[
        "Vista semanal, diária, mensal ou em lista — adaptada a cada papel na escola.",
        "Aulas recorrentes em poucos cliques, com data de início e fim configuráveis.",
        "Notificações automáticas: lembrete na véspera, alterações de horário, cancelamentos.",
      ]}
      body={[
        "Gerir a agenda de uma escola de condução em papel ou em folhas de cálculo significa horas perdidas a reconciliar horários, cruzar disponibilidades e avisar alunos. O calendário do Convlyx resolve tudo isso: cria aulas em segundos, deteta automaticamente quando dois instrutores estariam ocupados ao mesmo tempo, e mantém alunos e instrutores informados via notificações push e email.",
        "Para o instrutor, o calendário é o ponto central de cada dia — vê os seus alunos, marca presenças, abre o detalhe de cada aula. Para o aluno, é onde se inscreve em aulas teóricas disponíveis e confirma a próxima aula prática. Tudo funciona em telemóvel via aplicação web progressiva (PWA), sem necessidade de instalação numa loja de aplicações.",
      ]}
    />
  );
}
