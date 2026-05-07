import type { Metadata } from "next";
import { CalendarDays, Users, BookOpen, Shield, Smartphone, BarChart3 } from "lucide-react";
import { SeoLanding } from "@/app/no-tenant/_components/seo-landing";
import { SoftwareHeroMockup, SoftwareDeepDiveMockup } from "@/app/no-tenant/_components/mockups/software-mockup";

const URL = "https://convlyx.com/software-escola-conducao";
const TITLE = "Software para escola de condução em Portugal | Convlyx";
const DESCRIPTION =
  "Convlyx é o software de gestão para escolas de condução em Portugal. Agenda de aulas teóricas e práticas, gestão de alunos e instrutores, marcação de exames do IMT e relatórios — tudo numa plataforma web e móvel.";

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
    { "@type": "ListItem", position: 2, name: "Software para escolas de condução", item: URL },
  ],
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Software de gestão para escolas de condução",
  serviceType: "Driving school management software",
  description: DESCRIPTION,
  url: URL,
  inLanguage: "pt-PT",
  areaServed: { "@type": "Country", name: "Portugal" },
  provider: { "@id": "https://convlyx.com#organization" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};

export default function Page() {
  return (
    <>
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
        kicker="Software para escolas de condução"
        title="Toda a sua escola de condução"
        highlight="num só software."
        intro="O Convlyx é o software de gestão para escolas de condução em Portugal. Substitui folhas de cálculo, agendas em papel e ferramentas genéricas por uma plataforma única, pensada de raiz para o quotidiano de uma escola: aulas teóricas, aulas práticas, instrutores, alunos e exames do IMT."
        heroMockup={<SoftwareHeroMockup />}
        features={[
          {
            icon: <CalendarDays className="h-5 w-5 text-primary" />,
            title: "Agenda integrada",
            description: "Aulas teóricas e práticas num só calendário, com deteção automática de conflitos e recorrências.",
            gradient: "from-primary/10 to-emerald-400/10",
          },
          {
            icon: <Users className="h-5 w-5 text-primary" />,
            title: "Alunos e instrutores",
            description: "Perfis completos por papel, com histórico, presenças e categorias de carta de condução.",
            gradient: "from-blue-500/10 to-cyan-400/10",
          },
          {
            icon: <BookOpen className="h-5 w-5 text-primary" />,
            title: "Exames do IMT",
            description: "Marcação de exames teóricos e práticos com regras automáticas que evitam marcações inválidas.",
            gradient: "from-emerald-500/10 to-green-400/10",
          },
          {
            icon: <Smartphone className="h-5 w-5 text-primary" />,
            title: "Web e móvel",
            description: "Aplicação web progressiva — alunos e instrutores acedem ao seu horário no telemóvel sem instalar nada.",
            gradient: "from-violet-500/10 to-purple-400/10",
          },
          {
            icon: <Shield className="h-5 w-5 text-primary" />,
            title: "Multi-tenant seguro",
            description: "Cada escola tem o seu espaço com dados isolados e RLS ao nível da base de dados.",
            gradient: "from-amber-500/10 to-orange-400/10",
          },
          {
            icon: <BarChart3 className="h-5 w-5 text-primary" />,
            title: "Relatórios em PDF",
            description: "Exporte folhas de presença e relatórios de progresso para auditorias do IMT.",
            gradient: "from-rose-500/10 to-pink-400/10",
          },
        ]}
        midCta={{
          title: "Pronto para deixar o papel para trás?",
          description: "Em 30 minutos mostramos-lhe como o Convlyx encaixa no dia-a-dia da sua escola de condução.",
        }}
        deepDive={{
          kicker: "Pensado para o mercado português",
          title: "Conformidade IMT, isolamento por escola e papéis bem definidos",
          body: [
            "Procura um software para escola de condução? O Convlyx é a plataforma certa para escolas que querem deixar de gerir aulas em papel ou em folhas de cálculo. Tudo o que precisa — calendário, presenças, exames, alunos, instrutores — está num único sítio, acessível por qualquer membro da equipa com permissões adequadas (administrador, secretariado, instrutor, aluno).",
            "Cada escola tem o seu próprio espaço seguro com dados completamente isolados. O Convlyx é multi-tenant e foi pensado para o mercado português: suporta as 14 categorias de carta de condução do IMT, segue as regras de marcação de exames teóricos e práticos, e permite exportar folhas de presença e relatórios em PDF para auditorias.",
          ],
          bullets: [
            "14 categorias de carta de condução suportadas (AM, A1, A2, A, B1, B, BE, C1, C1E, C, D1, D1E, D, DE).",
            "Regras de exame: o exame prático só fica disponível depois do aluno ter passado o teórico.",
            "Subdomínio próprio por escola — escola.convlyx.com — com dados completamente isolados.",
          ],
          mockup: <SoftwareDeepDiveMockup />,
          mockupPosition: "left",
        }}
        related={[
          {
            href: "/calendario-aulas-conducao",
            title: "Calendário e agenda de aulas",
            description: "Veja como o calendário inteligente do Convlyx organiza aulas teóricas e práticas, deteta conflitos e envia notificações.",
          },
          {
            href: "/gestao-alunos-conducao",
            title: "Gestão de alunos da escola",
            description: "Perfil completo de cada aluno: presenças, faltas, categoria de carta e exames do IMT — tudo num só sítio.",
          },
        ]}
      />
    </>
  );
}
