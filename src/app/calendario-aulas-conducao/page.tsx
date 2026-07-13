import type { Metadata } from "next";
import { CalendarDays, Repeat, AlertTriangle, Bell, LayoutGrid, Smartphone } from "lucide-react";
import { SeoLanding } from "@/app/no-tenant/_components/seo-landing";
import { CalendarHeroMockup, CalendarDeepDiveMockup } from "@/app/no-tenant/_components/mockups/calendar-mockup";
import { ORGANIZATION_SCHEMA } from "@/lib/seo-schema";

const URL = "https://convlyx.com/calendario-aulas-conducao";
const TITLE = "Agenda de aulas de condução sem conflitos | Convlyx";
const DESCRIPTION =
  "Aulas teóricas e práticas num só calendário, com deteção automática de conflitos e notificações a alunos e instrutores. Peça uma demonstração.";

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

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: "https://convlyx.com" },
    { "@type": "ListItem", position: 2, name: "Calendário e agenda de aulas de condução", item: URL },
  ],
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Calendário e agenda de aulas para escolas de condução",
  serviceType: "Class scheduling software",
  description: DESCRIPTION,
  url: URL,
  inLanguage: "pt-PT",
  areaServed: { "@type": "Country", name: "Portugal" },
  provider: { "@id": "https://convlyx.com#organization" },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <SeoLanding
        themeIcon="calendar"
        kicker="Calendário e agenda de aulas de condução"
        title="A agenda da sua escola de condução,"
        highlight="sempre organizada."
        intro="O calendário do Convlyx mostra todas as aulas teóricas e práticas num só sítio, deteta conflitos de horário automaticamente e envia notificações a alunos e instrutores em tempo real."
        heroMockup={<CalendarHeroMockup />}
        features={[
          {
            icon: <LayoutGrid className="h-5 w-5 text-primary" />,
            title: "Várias vistas",
            description: "Semana, dia, mês ou lista, adaptada a cada papel na escola: instrutor, secretariado ou aluno.",
            gradient: "from-primary/10 to-emerald-400/10",
          },
          {
            icon: <Repeat className="h-5 w-5 text-primary" />,
            title: "Aulas recorrentes",
            description: "Crie séries de aulas em poucos cliques, com data de início e fim e dias da semana configuráveis.",
            gradient: "from-blue-500/10 to-cyan-400/10",
          },
          {
            icon: <AlertTriangle className="h-5 w-5 text-primary" />,
            title: "Deteção de conflitos",
            description: "O Convlyx avisa-o quando dois instrutores estariam ocupados ao mesmo tempo, antes de criar a aula.",
            gradient: "from-amber-500/10 to-orange-400/10",
          },
          {
            icon: <Bell className="h-5 w-5 text-primary" />,
            title: "Notificações automáticas",
            description: "Lembrete na véspera, alterações de horário e cancelamentos enviados via push e email.",
            gradient: "from-rose-500/10 to-pink-400/10",
          },
          {
            icon: <CalendarDays className="h-5 w-5 text-primary" />,
            title: "Inscrição em aulas",
            description: "Os alunos inscrevem-se em aulas teóricas com vagas disponíveis diretamente no telemóvel.",
            gradient: "from-emerald-500/10 to-green-400/10",
          },
          {
            icon: <Smartphone className="h-5 w-5 text-primary" />,
            title: "PWA, sem app store",
            description: "Aplicação web progressiva que funciona em qualquer telemóvel, sem instalação numa loja de aplicações.",
            gradient: "from-violet-500/10 to-purple-400/10",
          },
        ]}
        midCta={{
          title: "Diga adeus à agenda em papel",
          description: "Veja o calendário do Convlyx em ação numa demonstração de 30 minutos com a sua equipa.",
        }}
        deepDive={{
          kicker: "Calendário pensado para o terreno",
          title: "Recorrências, conflitos e notificações sem trabalho manual",
          body: [
            "Gerir a agenda de uma escola de condução em papel ou em folhas de cálculo significa horas perdidas a reconciliar horários, cruzar disponibilidades e avisar alunos. O calendário do Convlyx resolve tudo isso: cria aulas em segundos, deteta automaticamente quando dois instrutores estariam ocupados ao mesmo tempo, e mantém alunos e instrutores informados via notificações push e email.",
            "Para o instrutor, o calendário é o ponto central de cada dia: vê os seus alunos, marca presenças e abre o detalhe de cada aula. Para o aluno, é onde se inscreve em aulas teóricas disponíveis e confirma a próxima aula prática.",
          ],
          bullets: [
            "Crie aulas com um clique no calendário, ou em série com recorrência diária/semanal.",
            "Bloqueio automático contra dupla marcação de instrutor ou sala.",
            "Cancelamento com aviso prévio configurável por escola.",
          ],
          mockup: <CalendarDeepDiveMockup />,
          mockupPosition: "right",
        }}
        related={[
          {
            href: "/software-escola-conducao",
            title: "Software para escolas de condução",
            description: "Toda a sua escola de condução numa só plataforma: aulas, alunos, instrutores e exames do IMT.",
          },
          {
            href: "/gestao-alunos-conducao",
            title: "Gestão de alunos da escola",
            description: "Perfil completo de cada aluno: presenças, faltas, categoria de carta e exames do IMT, tudo num só sítio.",
          },
        ]}
        faqs={[
          {
            question: "Como funciona a deteção de conflitos de horário?",
            answer:
              "Antes de criar uma aula, o Convlyx avisa-o se o instrutor (ou a sala) já estaria ocupado nesse horário, evitando marcações sobrepostas.",
          },
          {
            question: "Posso criar aulas recorrentes?",
            answer:
              "Sim. Cria séries de aulas em poucos cliques, definindo a data de início e fim e os dias da semana. Cada aula fica independente e pode ser alterada individualmente.",
          },
          {
            question: "Os alunos e instrutores são avisados das aulas e alterações?",
            answer:
              "Sim. O Convlyx envia notificações automáticas por push e email (lembrete na véspera, alterações de horário e cancelamentos) a alunos e instrutores.",
          },
          {
            question: "Os alunos podem inscrever-se em aulas teóricas sozinhos?",
            answer:
              "Sim. Os alunos veem as aulas teóricas com vagas disponíveis e inscrevem-se diretamente no telemóvel, sem passar pelo secretariado.",
          },
          {
            question: "Preciso de instalar uma aplicação para ver o calendário?",
            answer:
              "Não. O calendário funciona no navegador e pode ser instalado como aplicação (PWA) no telemóvel, sem loja de aplicações.",
          },
        ]}
      />
    </>
  );
}
