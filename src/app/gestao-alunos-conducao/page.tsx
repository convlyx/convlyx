import type { Metadata } from "next";
import { SeoLanding } from "@/app/no-tenant/_components/seo-landing";

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

export default function Page() {
  return (
    <SeoLanding
      kicker="Gestão de alunos para escolas de condução"
      title="Cada aluno da sua escola de condução,"
      highlight="num só perfil."
      intro="O Convlyx reúne todo o percurso de cada aluno num único perfil — categoria de carta de condução, aulas teóricas e práticas frequentadas, presenças, faltas, exames marcados e resultados — tudo ao alcance do secretariado e do instrutor."
      bullets={[
        "Histórico completo de aulas, presenças e faltas, com taxa de assiduidade calculada automaticamente.",
        "Categoria de carta de condução por aluno (B, A, C, D…) — conforme as 14 categorias do IMT.",
        "Marcação e registo de exames teóricos e práticos, com bloqueio automático para evitar marcações inválidas.",
      ]}
      body={[
        "A gestão de alunos numa escola de condução em Portugal envolve manter o registo de cada categoria de carta, das aulas teóricas e práticas, das presenças e dos exames realizados. O Convlyx automatiza tudo isto: ao inscrever um aluno, escolhe-se a categoria de carta inicial e o sistema gera o perfil completo, com filtros para aulas relevantes e cálculo automático de progresso.",
        "O secretariado tem uma vista clara da turma — quem está ativo, quem completou a teórica, quem está pronto para o exame prático — e pode exportar relatórios de progresso em PDF a qualquer momento. Para auditorias do IMT, todos os dados estão disponíveis e bem organizados, sem necessidade de remontar registos a partir de papel.",
      ]}
    />
  );
}
