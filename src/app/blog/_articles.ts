import "server-only";

/**
 * Informational top-of-funnel articles, authored in-repo (trusted Markdown).
 * Unlike `novidades` posts, these live ONLY on the public blog and never appear
 * in the in-app staff changelog, so prospect-facing SEO content doesn't pollute
 * existing customers' "Novidades" feed. See the SEO spec
 * (docs/superpowers/specs/2026-07-13-seo-improvements-spec.md, item C).
 *
 * Each article ends with a soft "pedir demonstração" conversion via <ArticleCta>.
 */

export type BlogArticleRelated = {
  href: string;
  title: string;
  description: string;
};

export type BlogArticle = {
  slug: string;
  /** H1 + base of the page <title>. */
  title: string;
  /** Meta description; keep ≤155 chars. */
  description: string;
  /** Publish day, YYYY-MM-DD. */
  date: string;
  /** Approximate reading time, minutes. */
  readingMinutes: number;
  /** Short teaser shown on the /blog index. */
  excerpt: string;
  /** Trusted, authored Markdown body (no frontmatter). */
  body: string;
  /** Internal links to the product pages, for SEO + navigation. */
  related: BlogArticleRelated[];
};

const RELATED_SOFTWARE: BlogArticleRelated = {
  href: "/software-escola-conducao",
  title: "Software para escolas de condução",
  description:
    "Toda a sua escola de condução numa só plataforma: aulas, alunos, instrutores e exames do IMT.",
};

const RELATED_CALENDAR: BlogArticleRelated = {
  href: "/calendario-aulas-conducao",
  title: "Calendário e agenda de aulas",
  description:
    "Aulas teóricas e práticas num só calendário, com deteção de conflitos e notificações automáticas.",
};

const RELATED_STUDENTS: BlogArticleRelated = {
  href: "/gestao-alunos-conducao",
  title: "Gestão de alunos da escola",
  description:
    "Perfil completo de cada aluno: presenças, faltas, categoria de carta e exames do IMT.",
};

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "como-gerir-escola-conducao-sem-papel",
    title: "Como gerir uma escola de condução sem papel",
    description:
      "Guia prático para digitalizar a gestão da sua escola de condução: agenda, presenças, exames e comunicação, sem folhas de cálculo nem papel.",
    date: "2026-04-22",
    readingMinutes: 6,
    excerpt:
      "Da agenda em papel às folhas de cálculo dispersas: como passar a gestão da escola para uma única plataforma digital, passo a passo.",
    body: `Muitas escolas de condução em Portugal ainda gerem o dia-a-dia com uma agenda em papel, cadernos de presenças e várias folhas de cálculo espalhadas por diferentes computadores. Funciona, até deixar de funcionar. Basta um instrutor de baixa, uma marcação sobreposta ou uma auditoria do IMT para se perceber quanto tempo se perde a reconciliar informação que devia estar num só sítio.

Digitalizar a gestão de uma escola de condução não é comprar mais uma ferramenta genérica. É substituir o papel e as folhas de cálculo por um sistema pensado para o fluxo real de uma escola: candidatos, aulas teóricas e práticas, instrutores, exames e comunicação. Este guia mostra por onde começar.

## Porque é que o papel deixa de chegar

O papel e as folhas de cálculo têm três problemas que se agravam à medida que a escola cresce:

- **Informação duplicada e dispersa.** O mesmo aluno aparece na agenda, no caderno de presenças e numa folha de cálculo, e nenhuma das três está totalmente atualizada.
- **Sem visão em tempo real.** Ninguém sabe, sem procurar, quem está pronto para o exame, quem faltou ou que instrutores estão livres amanhã de manhã.
- **Difícil de auditar.** Quando o IMT pede registos, remontar folhas de presença a partir de papel consome horas.

## Passo 1: Centralizar a agenda

O primeiro passo é pôr todas as aulas, teóricas e práticas, num único calendário partilhado. Em vez de cada instrutor gerir a sua própria agenda, a escola passa a ter uma vista comum, onde é imediato ver conflitos de horário antes de eles acontecerem.

Um bom sistema deteta automaticamente quando um instrutor (ou uma sala) ficaria com duas aulas ao mesmo tempo e avisa antes de a marcação ser criada.

## Passo 2: Registar presenças no momento

As presenças devem ser marcadas na própria aula, não copiadas mais tarde para um caderno. Com o registo digital, a taxa de assiduidade de cada aluno é calculada sozinha e fica sempre disponível para o secretariado, para o instrutor e para eventuais auditorias.

## Passo 3: Acompanhar o percurso de cada aluno

Cada candidato tem um percurso: a categoria de carta pretendida, as aulas teóricas e práticas frequentadas, os exames marcados e os resultados. Reunir tudo isto num único perfil evita perguntas repetidas ("este aluno já fez a teórica?") e torna claro quem está pronto para avançar.

## Passo 4: Automatizar a comunicação

Grande parte do tempo do secretariado vai para lembrar alunos das aulas e avisar de alterações. As notificações automáticas (lembrete na véspera, alterações de horário, cancelamentos) libertam esse tempo e reduzem as faltas.

## Passo 5: Ter os relatórios prontos

Quando os dados estão organizados de raiz, exportar folhas de presença ou relatórios de progresso em PDF passa a ser questão de segundos. É a diferença entre preparar uma auditoria em minutos ou em dias.

## Por onde começar

Não é preciso mudar tudo de uma vez. A ordem acima funciona bem: comece pela agenda, depois pelas presenças e pelos perfis dos alunos. Cada passo remove uma fonte de papel e de trabalho manual.

O Convlyx foi pensado exatamente para este percurso. Reúne agenda, presenças, alunos, instrutores e exames do IMT numa só plataforma, acessível no computador e no telemóvel. Se quiser ver como encaixa no dia-a-dia da sua escola, peça uma demonstração.`,
    related: [RELATED_SOFTWARE, RELATED_CALENDAR, RELATED_STUDENTS],
  },
  {
    slug: "quanto-custa-abrir-escola-conducao-portugal",
    title: "Quanto custa abrir uma escola de condução em Portugal",
    description:
      "Quanto custa abrir uma escola de condução em Portugal? Veja os principais custos: alvará do IMT, instalações, frota, instrutores e seguros.",
    date: "2026-05-14",
    readingMinutes: 7,
    excerpt:
      "Alvará do IMT, instalações, frota, instrutores certificados e seguros: os principais custos a considerar antes de abrir uma escola de condução.",
    body: `Abrir uma escola de condução em Portugal é um projeto com investimento inicial significativo e um enquadramento legal próprio, regulado pelo IMT (Instituto da Mobilidade e dos Transportes). Antes de avançar, vale a pena perceber quais são os grandes blocos de custo e o que cada um envolve.

> Os valores indicados abaixo são aproximados e servem apenas para dar ordem de grandeza. Os montantes reais variam com a localização, a dimensão do projeto e as categorias de carta que pretende oferecer. Confirme sempre os requisitos e as taxas atuais junto do IMT.

## 1. Licenciamento e alvará do IMT

O funcionamento de uma escola de condução depende de autorização do IMT. Há requisitos a cumprir quanto às instalações, aos veículos, aos instrutores e ao responsável técnico, além de taxas administrativas associadas ao processo de licenciamento. Este é o passo que condiciona todos os outros: sem alvará, não há atividade.

## 2. Instalações

Precisa de um espaço que cumpra os requisitos legais, tipicamente com:

- uma sala de formação teórica adequada ao número de candidatos;
- área administrativa e de atendimento;
- condições de acessibilidade e segurança.

O custo depende muito da zona do país: a renda em Lisboa ou no Porto pouco tem a ver com a de um concelho do interior. À renda somam-se obras de adaptação, mobiliário e equipamento informático.

## 3. Frota de veículos

A frota é, quase sempre, o maior custo inicial. Os veículos de instrução têm de estar equipados para formação (por exemplo, duplos comandos) e adequados às categorias que a escola vai oferecer: um ligeiro para a categoria B, mas eventualmente motociclos ou pesados para outras categorias.

As opções habituais são a compra ou o *leasing*/aluguer de longa duração. O *leasing* reduz o desembolso inicial mas acrescenta um custo mensal fixo. A manutenção, os pneus e o combustível são custos correntes a não esquecer.

## 4. Instrutores certificados

Uma escola de condução precisa de instrutores com a certificação exigida e de um responsável/diretor com as competências previstas na lei. Os salários da equipa formadora são o principal custo corrente, a par da frota.

## 5. Seguros

Além dos seguros obrigatórios dos veículos, há a considerar o seguro de responsabilidade civil da atividade e a cobertura dos candidatos durante a formação. É uma rubrica que convém orçamentar com margem.

## 6. Material didático e software de gestão

Por fim, os custos de operação: material pedagógico, plataformas de formação teórica e um software para gerir a escola (agenda de aulas, alunos, instrutores, presenças e exames). Comparado com a frota e as instalações, é um custo pequeno, mas é o que determina quanto tempo a equipa perde (ou poupa) em tarefas administrativas.

## Custos iniciais vs. custos correntes

Ao fazer as contas, separe dois tipos de custo:

- **Investimento inicial:** licenciamento, obras nas instalações, aquisição ou entrada da frota, equipamento.
- **Custos correntes mensais:** renda, salários, combustível e manutenção, seguros, software e material.

É a soma dos custos correntes que determina o ponto de equilíbrio, ou seja, quantos candidatos precisa de ter por mês para a escola ser sustentável.

## Um software que se paga em tempo

Não pode controlar o preço da frota nem o valor das rendas, mas pode controlar quanto tempo a sua equipa perde em papelada. O Convlyx reúne a agenda, os alunos, os instrutores e os exames do IMT numa só plataforma, pensada para o mercado português. Se está a planear abrir (ou já gere) uma escola de condução, peça uma demonstração e veja quanto trabalho administrativo pode poupar.`,
    related: [RELATED_SOFTWARE, RELATED_STUDENTS, RELATED_CALENDAR],
  },
  {
    slug: "categorias-carta-conducao-portugal-escolas",
    title: "Categorias de carta de condução em Portugal: guia para escolas",
    description:
      "As categorias de carta do IMT (AM, A, B, C, D e reboques) e o que cada escola de condução precisa de gerir por categoria.",
    date: "2026-05-29",
    readingMinutes: 6,
    excerpt:
      "De AM a DE: o que cada categoria de carta de condução abrange e como organizar a formação por categoria na sua escola.",
    body: `Uma escola de condução organiza grande parte do seu trabalho à volta das categorias de carta: os veículos que precisa, os instrutores habilitados, as aulas e os exames de cada aluno. Perceber o que cada categoria abrange ajuda a estruturar a formação e a evitar erros de marcação.

> As idades mínimas, os tipos de veículo e os requisitos de exame de cada categoria são definidos pelo IMT (Instituto da Mobilidade e dos Transportes) e podem mudar. Confirme sempre os valores atuais junto do IMT.

## Como as categorias se agrupam

Em Portugal, as categorias de carta de condução organizam-se em quatro grandes famílias:

- **Motociclos e ciclomotores:** AM, A1, A2, A
- **Ligeiros:** B1, B, BE
- **Pesados de mercadorias:** C1, C1E, C
- **Pesados de passageiros:** D1, D1E, D, DE

### Motociclos e ciclomotores (AM, A1, A2, A)

Cobrem desde ciclomotores e motociclos ligeiros (AM, A1) até motociclos de maior cilindrada (A2, A), normalmente com acesso progressivo consoante a idade e a experiência do condutor.

### Ligeiros (B1, B, BE)

A categoria B, dos automóveis ligeiros, é a mais procurada pela generalidade dos candidatos. B1 abrange quadriciclos, e BE acrescenta a possibilidade de rebocar um atrelado acima de certos limites.

### Pesados de mercadorias (C1, C1E, C)

Para veículos de transporte de mercadorias, com C1 para pesos intermédios e C para pesados; a variante "E" (C1E, CE) aplica-se aos conjuntos com reboque.

### Pesados de passageiros (D1, D1E, D, DE)

Para transporte de passageiros, de minibus (D1) a autocarros (D), também com variantes para reboque.

## O que muda na gestão consoante a categoria

Cada categoria tem implicações práticas para a escola:

- **Veículos:** cada categoria exige veículos de instrução adequados e equipados para formação.
- **Instrutores:** a formação em pesados ou motociclos pode exigir instrutores habilitados para essas categorias.
- **Percurso do aluno:** o número de aulas e o tipo de exame variam com a categoria pretendida.

## Organizar a formação por categoria

Quando cada aluno está associado à sua categoria de carta, torna-se simples filtrar quem precisa de que aulas, que veículos reservar e quem está pronto para exame, em vez de cruzar essa informação à mão.

O Convlyx suporta as 14 categorias de carta de condução do IMT (AM, A1, A2, A, B1, B, BE, C1, C1E, C, D1, D1E, D, DE): cada aluno é inscrito na sua categoria e o sistema filtra automaticamente as aulas e os exames relevantes. Peça uma demonstração para ver como simplifica a gestão da sua escola.`,
    related: [RELATED_STUDENTS, RELATED_SOFTWARE, RELATED_CALENDAR],
  },
  {
    slug: "reduzir-faltas-alunos-escola-conducao",
    title: "Como reduzir as faltas dos alunos numa escola de condução",
    description:
      "As faltas custam tempo e receita. Veja estratégias práticas (lembretes, política de cancelamento e acompanhamento) para as reduzir.",
    date: "2026-06-18",
    readingMinutes: 5,
    excerpt:
      "Cada falta é uma aula perdida e um instrutor parado. Estratégias práticas para reduzir os no-shows na sua escola de condução.",
    body: `Numa escola de condução, cada falta não avisada é uma aula perdida, um instrutor parado e receita que não volta. Reduzir as faltas é uma das formas mais diretas de aumentar a rentabilidade, sem precisar de angariar mais alunos.

## 1. Lembretes automáticos

Grande parte das faltas são simples esquecimentos. Um lembrete na véspera, e outro no próprio dia, reduz significativamente os no-shows. Automatizar estes lembretes evita depender do secretariado para ligar a cada aluno, um a um.

## 2. Política de cancelamento clara

Definir um prazo mínimo para cancelar (por exemplo, 24 horas antes) e comunicá-lo desde a inscrição cria responsabilidade. O mais importante não é a regra em si, mas que seja conhecida por todos e aplicada de forma consistente.

## 3. Facilitar a remarcação

Quando cancelar e remarcar é simples, o aluno avisa em vez de faltar sem mais. Um processo complicado empurra o candidato para o no-show, porque desistir acaba por ser mais fácil do que tratar da remarcação.

## 4. Confirmar as aulas

Pedir uma confirmação simples antes da aula transforma uma marcação passiva num compromisso ativo. Um aluno que confirmou tem muito menos probabilidade de faltar.

## 5. Acompanhar a assiduidade

Ter a taxa de presenças de cada aluno à vista permite identificar cedo quem falta com frequência e agir a tempo. Uma conversa no momento certo evita muitas vezes a desistência total do curso.

## O papel do software

Quase todas estas estratégias dependem de comunicação atempada e de dados sempre atualizados, precisamente o que é difícil com agendas em papel. O Convlyx envia lembretes automáticos por push e email, regista presenças no momento e calcula a assiduidade de cada aluno, para que a sua equipa aja com base em dados e não em suposições. Peça uma demonstração para ver como.`,
    related: [RELATED_CALENDAR, RELATED_STUDENTS, RELATED_SOFTWARE],
  },
  {
    slug: "organizar-marcacao-exames-imt-escola-conducao",
    title: "Exames do IMT: como organizar as marcações na sua escola",
    description:
      "Organizar os exames do IMT sem erros: saber quem está pronto, evitar marcações inválidas e acompanhar resultados na sua escola de condução.",
    date: "2026-07-08",
    readingMinutes: 6,
    excerpt:
      "Quem está pronto para o exame? Já passou a teórica? Como manter as marcações de exames do IMT organizadas e sem erros.",
    body: `A marcação de exames é um dos pontos mais sensíveis da gestão de uma escola de condução. Um exame marcado para um aluno que ainda não cumpre os pré-requisitos é tempo e dinheiro perdidos, além de uma fonte de frustração para o candidato e para a equipa.

> As regras e os prazos de marcação de exames são definidos pelo IMT; confirme sempre os requisitos atuais. Este artigo foca-se na organização interna do processo, dentro dessas regras.

## Saber quem está pronto

Antes de marcar, é preciso saber, sem andar a folhear papéis, quem completou a formação teórica, quem já fez as aulas práticas necessárias e quem já foi aprovado no exame teórico. Ter esta informação centralizada por aluno evita marcações prematuras.

## Respeitar a sequência teórica → prática

Regra geral, o exame prático só faz sentido depois de o aluno ter sido aprovado no exame teórico. Garantir esta sequência manualmente é propenso a erros; o ideal é que o próprio sistema impeça marcações que a violem.

## Evitar marcações inválidas

Categoria errada, pré-requisitos em falta, datas sobrepostas: pequenos erros de marcação geram retrabalho e atrasos. Validações automáticas no momento da marcação poupam esse retrabalho.

## Acompanhar os resultados

Registar o resultado de cada exame (aprovado ou reprovado) mantém o percurso do aluno atualizado e permite reagir depressa: remarcar, reforçar aulas ou avançar para a fase seguinte.

## Como o Convlyx ajuda

O Convlyx associa cada exame ao aluno e à sua categoria de carta, e aplica automaticamente regras como "o exame prático só fica disponível depois do teórico". O secretariado vê num só ecrã quem está pronto e regista os resultados, sem cadernos paralelos nem folhas de cálculo. Peça uma demonstração para ver o processo completo.`,
    related: [RELATED_STUDENTS, RELATED_SOFTWARE, RELATED_CALENDAR],
  },
];

export function getAllArticles(): BlogArticle[] {
  // Newest first; ties broken by slug for deterministic ordering.
  return [...BLOG_ARTICLES].sort(
    (a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug),
  );
}

export function getArticleBySlug(slug: string): BlogArticle | null {
  return BLOG_ARTICLES.find((a) => a.slug === slug) ?? null;
}
