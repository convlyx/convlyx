import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../_components/legal-page";
import { COMPANY, formatLegalEntity } from "@/lib/company";

const URL = "https://convlyx.com/termos-e-condicoes";
const TITLE = "Termos e Condições | Convlyx";
const DESCRIPTION =
  "Termos e condições de utilização do Convlyx — software de gestão para escolas de condução em Portugal.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <LegalPage title="Termos e Condições" lastUpdated="2026-05-08">
      <Section title="1. Aceitação dos termos">
        <p>
          Ao criar uma conta no Convlyx ou ao utilizar a plataforma de qualquer
          forma, declara que leu, compreendeu e aceita os presentes Termos e
          Condições, bem como a nossa{" "}
          <Link href="/politica-de-privacidade" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </Section>

      <Section title="2. Identificação">
        <p>
          O {COMPANY.brandName} é um software-as-a-service (SaaS) de gestão para
          escolas de condução em Portugal, fornecido por{" "}
          <strong>{formatLegalEntity()}</strong>. Contacto:{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-primary hover:underline"
          >
            {COMPANY.contactEmail}
          </a>
          .
        </p>
      </Section>

      <Section title="3. Definições">
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Plataforma</strong> — a aplicação web e móvel disponibilizada em convlyx.com e respetivos subdomínios.</li>
          <li><strong>Cliente</strong> — a escola de condução que contrata o serviço.</li>
          <li><strong>Utilizador</strong> — qualquer pessoa que aceda à plataforma (administrador, secretariado, instrutor ou aluno).</li>
          <li><strong>Subdomínio</strong> — o endereço dedicado da escola (ex.: escola.convlyx.com).</li>
        </ul>
      </Section>

      <Section title="4. Descrição do serviço">
        <p>
          O Convlyx disponibiliza ferramentas para gerir o quotidiano de uma
          escola de condução, incluindo: agenda de aulas teóricas e práticas,
          gestão de alunos e instrutores, marcação e registo de exames do IMT,
          presenças, relatórios e notificações. As funcionalidades disponíveis
          podem evoluir ao longo do tempo.
        </p>
      </Section>

      <Section title="5. Conta e segurança">
        <p>
          Cada utilizador é responsável por manter a confidencialidade das suas
          credenciais de acesso e por todas as ações realizadas na sua conta.
          Deve notificar-nos imediatamente em caso de utilização não autorizada.
          Pode ser pedida a verificação adicional em situações suspeitas.
        </p>
      </Section>

      <Section title="6. Utilização aceitável">
        <p>O utilizador compromete-se a:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Não utilizar a plataforma para fins ilícitos ou contrários à lei portuguesa.</li>
          <li>Não tentar aceder a dados de outras escolas ou utilizadores não autorizados.</li>
          <li>Não interferir com a segurança, integridade ou desempenho da plataforma.</li>
          <li>Não utilizar a plataforma para enviar comunicações não solicitadas (spam).</li>
          <li>Manter atualizados os dados da escola e dos utilizadores associados.</li>
        </ul>
        <p>
          O incumprimento pode resultar na suspensão ou cessação imediata da conta,
          sem direito a reembolso.
        </p>
      </Section>

      <Section title="7. Conteúdo do utilizador">
        <p>
          O Cliente mantém a propriedade de todos os dados que insere na plataforma
          (alunos, aulas, exames, etc.). Concede ao Convlyx uma licença limitada,
          não exclusiva, para tratar esses dados na medida estritamente necessária
          para prestar o serviço. Cabe ao Cliente garantir que tem fundamento
          jurídico para o tratamento dos dados pessoais que insere (e.g. dados de
          alunos).
        </p>
      </Section>

      <Section title="8. Pagamento">
        <p>
          O Convlyx encontra-se em fase de lançamento. Os preços e condições de
          pagamento são acordados individualmente com cada Cliente e formalizados
          em proposta escrita. Quando aplicáveis, os valores incluem IVA à taxa
          legal em vigor em Portugal.
        </p>
      </Section>

      <Section title="9. Proteção de dados e RGPD">
        <p>
          O Cliente é responsável pelo tratamento (controlador) dos dados pessoais
          dos seus alunos, instrutores e colaboradores. O Convlyx atua como
          subcontratante (processador) ao abrigo do artigo 28.º do RGPD.
        </p>
        <p>
          Mediante pedido em{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-primary hover:underline"
          >
            {COMPANY.contactEmail}
          </a>
          , disponibilizamos um <strong>Contrato de Subcontratação (DPA)</strong>{" "}
          que regula este tratamento, incluindo a lista de subcontratantes
          autorizados e o regime de notificação de incidentes.
        </p>
      </Section>

      <Section title="10. Propriedade intelectual">
        <p>
          O software, marca, logótipo, conteúdos editoriais, design e código do
          Convlyx são propriedade exclusiva da Convlyx e estão protegidos por
          legislação de propriedade intelectual aplicável. Nenhuma utilização não
          autorizada é permitida.
        </p>
      </Section>

      <Section title="11. Limitação de responsabilidade">
        <p>
          O Convlyx esforça-se por manter a plataforma disponível e funcional, mas
          o serviço é fornecido &quot;tal como está&quot;, sem garantias expressas de
          ininterrupção ou ausência de erros. Na máxima medida permitida pela lei
          aplicável, a responsabilidade do Convlyx perante o Cliente, por qualquer
          motivo, fica limitada ao valor pago pelo Cliente nos doze meses
          anteriores ao facto que originou a responsabilidade.
        </p>
        <p>
          O Convlyx não responde por danos indiretos, lucros cessantes, perda de
          dados não imputável a culpa grave, ou consequências decorrentes da
          utilização indevida da plataforma pelo Cliente ou pelos seus utilizadores.
        </p>
      </Section>

      <Section title="12. Suspensão e cessação">
        <p>
          Qualquer das partes pode cessar o contrato com aviso prévio. O Convlyx
          pode suspender ou cessar imediatamente o acesso à plataforma em caso de
          incumprimento grave dos presentes termos, falta de pagamento, ou risco
          para a segurança da plataforma ou de outros clientes. Após a cessação,
          os dados do Cliente ficam disponíveis para exportação durante 30 dias,
          após os quais são eliminados (sem prejuízo de prazos legais de
          conservação).
        </p>
      </Section>

      <Section title="13. Alterações aos termos">
        <p>
          O Convlyx pode atualizar estes termos. Alterações materiais serão
          comunicadas ao Cliente com pelo menos 30 dias de antecedência. A
          continuação do uso após essa data implica aceitação dos novos termos.
        </p>
      </Section>

      <Section title="14. Lei aplicável e foro">
        <p>
          Os presentes termos regem-se pela lei portuguesa. Para resolução de
          qualquer litígio que não possa ser resolvido amigavelmente, as partes
          designam o foro da Comarca de {COMPANY.jurisdictionDistrict}, com
          expressa renúncia a qualquer outro.
        </p>
      </Section>

      <Section title="15. Contacto">
        <p>
          Para questões relativas a estes Termos e Condições, contacte-nos em{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-primary hover:underline"
          >
            {COMPANY.contactEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
