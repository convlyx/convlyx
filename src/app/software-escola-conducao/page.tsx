import type { Metadata } from "next";
import { SeoLanding } from "@/app/no-tenant/_components/seo-landing";

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

export default function Page() {
  return (
    <SeoLanding
      kicker="Software para escolas de condução"
      title="Toda a sua escola de condução"
      highlight="num só software."
      intro="O Convlyx é o software de gestão para escolas de condução em Portugal. Substitui folhas de cálculo, agendas em papel e ferramentas genéricas por uma plataforma única, pensada de raiz para o quotidiano de uma escola: aulas teóricas, aulas práticas, instrutores, alunos e exames do IMT."
      bullets={[
        "Agenda inteligente para aulas teóricas e práticas, com deteção automática de conflitos.",
        "Gestão de alunos, instrutores e categorias de carta de condução em conformidade com o IMT.",
        "Aplicação web e móvel — alunos e instrutores acedem ao seu horário de qualquer lugar.",
      ]}
      body={[
        "Procura um software para escola de condução? O Convlyx é a plataforma certa para escolas que querem deixar de gerir aulas em papel ou em folhas de cálculo. Tudo o que precisa — calendário, presenças, exames, alunos, instrutores — está num único sítio, acessível por qualquer membro da equipa com permissões adequadas (administrador, secretariado, instrutor, aluno).",
        "Cada escola tem o seu próprio espaço seguro com dados completamente isolados. O Convlyx é multi-tenant e foi pensado para o mercado português: suporta as 14 categorias de carta de condução do IMT, segue as regras de marcação de exames teóricos e práticos, e permite exportar folhas de presença e relatórios em PDF para auditorias.",
      ]}
    />
  );
}
