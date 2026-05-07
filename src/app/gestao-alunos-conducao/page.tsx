import type { Metadata } from "next";
import { User, Award, Calendar, BarChart3, FileText, Filter } from "lucide-react";
import { SeoLanding } from "@/app/no-tenant/_components/seo-landing";
import { StudentsHeroMockup, StudentsDeepDiveMockup } from "@/app/no-tenant/_components/mockups/students-mockup";

const URL = "https://convlyx.com/gestao-alunos-conducao";
const TITLE = "Gestão de alunos para escolas de condução | Convlyx";
const DESCRIPTION =
  "Perfil completo de cada aluno: histórico de aulas, presenças, faltas, exames teóricos e práticos. O Convlyx organiza a gestão de alunos da sua escola de condução por categoria de carta, em conformidade com o IMT.";

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
    { "@type": "ListItem", position: 2, name: "Gestão de alunos para escolas de condução", item: URL },
  ],
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Gestão de alunos para escolas de condução",
  serviceType: "Student management software",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <SeoLanding
        kicker="Gestão de alunos para escolas de condução"
        title="Cada aluno da sua escola de condução,"
        highlight="num só perfil."
        intro="O Convlyx reúne todo o percurso de cada aluno num único perfil — categoria de carta de condução, aulas teóricas e práticas frequentadas, presenças, faltas, exames marcados e resultados — tudo ao alcance do secretariado e do instrutor."
        heroMockup={<StudentsHeroMockup />}
        features={[
          {
            icon: <User className="h-5 w-5 text-primary" />,
            title: "Perfil completo",
            description: "Histórico de aulas, presenças, faltas e exames de cada aluno — tudo num único ecrã.",
            gradient: "from-primary/10 to-emerald-400/10",
          },
          {
            icon: <Award className="h-5 w-5 text-primary" />,
            title: "14 categorias do IMT",
            description: "Cada aluno é inscrito numa categoria de carta de condução (B, A, C, D…) com filtros automáticos.",
            gradient: "from-blue-500/10 to-cyan-400/10",
          },
          {
            icon: <Calendar className="h-5 w-5 text-primary" />,
            title: "Marcação de exames",
            description: "Marcação de exames teóricos e práticos com bloqueio automático para evitar marcações inválidas.",
            gradient: "from-amber-500/10 to-orange-400/10",
          },
          {
            icon: <BarChart3 className="h-5 w-5 text-primary" />,
            title: "Assiduidade",
            description: "Taxa de presenças calculada automaticamente, por aluno e por turma.",
            gradient: "from-emerald-500/10 to-green-400/10",
          },
          {
            icon: <Filter className="h-5 w-5 text-primary" />,
            title: "Filtros e segmentação",
            description: "Veja rapidamente quem está pronto para o exame, quem completou a teórica ou quem está em risco.",
            gradient: "from-violet-500/10 to-purple-400/10",
          },
          {
            icon: <FileText className="h-5 w-5 text-primary" />,
            title: "Relatórios em PDF",
            description: "Exporte folhas de presença e relatórios de progresso para auditorias do IMT.",
            gradient: "from-rose-500/10 to-pink-400/10",
          },
        ]}
        midCta={{
          title: "Conheça melhor cada aluno da sua escola",
          description: "Em 30 minutos mostramos como o Convlyx organiza o percurso de cada aluno, da inscrição ao exame final.",
        }}
        deepDive={{
          kicker: "Conformidade IMT, sem papelada",
          title: "Da inscrição ao exame prático, tudo registado e auditável",
          body: [
            "A gestão de alunos numa escola de condução em Portugal envolve manter o registo de cada categoria de carta, das aulas teóricas e práticas, das presenças e dos exames realizados. O Convlyx automatiza tudo isto: ao inscrever um aluno, escolhe-se a categoria de carta inicial e o sistema gera o perfil completo, com filtros para aulas relevantes e cálculo automático de progresso.",
            "O secretariado tem uma vista clara da turma — quem está ativo, quem completou a teórica, quem está pronto para o exame prático — e pode exportar relatórios de progresso em PDF a qualquer momento. Para auditorias do IMT, todos os dados estão disponíveis e bem organizados, sem necessidade de remontar registos a partir de papel.",
          ],
          bullets: [
            "Bloqueio automático: o exame prático só fica disponível após o aluno passar o teórico.",
            "Filtros por categoria de carta, estado (ativo, aprovado, em risco) e progresso.",
            "Histórico completo preservado mesmo depois do aluno concluir o curso.",
          ],
          mockup: <StudentsDeepDiveMockup />,
          mockupPosition: "left",
        }}
        related={[
          {
            href: "/software-escola-conducao",
            title: "Software para escolas de condução",
            description: "Toda a sua escola de condução numa só plataforma: aulas, alunos, instrutores e exames do IMT.",
          },
          {
            href: "/calendario-aulas-conducao",
            title: "Calendário e agenda de aulas",
            description: "Veja como o calendário inteligente do Convlyx organiza aulas teóricas e práticas, deteta conflitos e envia notificações.",
          },
        ]}
      />
    </>
  );
}
