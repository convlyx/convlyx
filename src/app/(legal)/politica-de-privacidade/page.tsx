import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection as Section } from "../_components/legal-page";
import { COMPANY, formatLegalEntity } from "@/lib/company";
import { LEGAL_VERSIONS, SUBPROCESSORS } from "@/lib/legal";

const URL = "https://convlyx.com/politica-de-privacidade";
const TITLE = "Política de Privacidade | Convlyx";
const DESCRIPTION =
  "Política de privacidade do Convlyx — software de gestão para escolas de condução em Portugal. Como tratamos os seus dados ao abrigo do RGPD.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <LegalPage title="Política de Privacidade" lastUpdated={LEGAL_VERSIONS.privacy}>
      <Section title="1. Quem somos">
        <p>
          O {COMPANY.brandName} é um software de gestão para escolas de condução
          em Portugal, fornecido por <strong>{formatLegalEntity()}</strong>. Para
          qualquer questão relativa a esta política ou ao tratamento dos seus
          dados pessoais, contacte-nos em{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-primary hover:underline"
          >
            {COMPANY.contactEmail}
          </a>
          .
        </p>
      </Section>

      <Section title="2. Quem é o responsável pelo tratamento">
        <p>
          O responsável pelo tratamento depende do contexto:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Quando contacta o Convlyx</strong> através do site (pedido de
            demonstração, formulários, emails), o Convlyx é o responsável pelo
            tratamento dos seus dados.
          </li>
          <li>
            <strong>Quando utiliza a plataforma como aluno, instrutor ou colaborador
            de uma escola de condução</strong>, a sua escola de condução é o
            responsável pelo tratamento. O Convlyx atua apenas como subcontratante
            (processador) ao abrigo de um Contrato de Subcontratação (DPA) celebrado
            com a escola.
          </li>
        </ul>
      </Section>

      <Section title="3. Que dados recolhemos">
        <p>Recolhemos os seguintes tipos de dados:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Dados de identificação e contacto:</strong> nome, email, número
            de telefone, escola onde trabalha ou estuda.
          </li>
          <li>
            <strong>Dados de conta:</strong> palavra-passe (encriptada), papel
            (administrador, secretariado, instrutor, aluno), data de criação e
            último acesso.
          </li>
          <li>
            <strong>Dados de utilização da escola:</strong> categorias de carta de
            condução, aulas frequentadas, presenças, faltas, exames marcados e
            resultados, notas dos instrutores.
          </li>
          <li>
            <strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo e
            navegador, registo de acessos e ações na plataforma para fins de
            segurança e diagnóstico.
          </li>
          <li>
            <strong>Dados de marketing:</strong> informação que nos envia
            voluntariamente através do formulário de pedido de demonstração.
          </li>
        </ul>
      </Section>

      <Section title="4. Para que usamos os seus dados">
        <p>Os seus dados pessoais são tratados para as seguintes finalidades:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Prestar o serviço de gestão da escola de condução (execução do contrato).</li>
          <li>Autenticar utilizadores e proteger a sua conta (interesse legítimo).</li>
          <li>Enviar notificações operacionais (lembretes de aulas, alterações, cancelamentos, exames).</li>
          <li>Cumprir obrigações legais aplicáveis em Portugal (e.g. registo para auditorias do IMT).</li>
          <li>Responder a pedidos de demonstração ou contacto comercial (consentimento).</li>
          <li>Melhorar a plataforma através de análise de utilização agregada (interesse legítimo).</li>
        </ul>
      </Section>

      <Section title="5. Quanto tempo guardamos os seus dados">
        <p>
          Conservamos os dados enquanto a sua conta estiver ativa e enquanto for
          necessário para as finalidades acima. Após a desativação da conta, os
          dados são mantidos durante o período legalmente exigido (até 5 anos para
          fins fiscais ou de auditoria do IMT, quando aplicável). Pode solicitar a
          eliminação dos seus dados a qualquer momento através de{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-primary hover:underline"
          >
            {COMPANY.contactEmail}
          </a>
          .
        </p>
      </Section>

      <Section title="6. Com quem partilhamos os seus dados">
        <p>
          Os seus dados <strong>nunca são vendidos</strong>. Podem ser partilhados,
          apenas no estritamente necessário, com os seguintes subcontratantes que
          nos prestam serviços técnicos:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          {SUBPROCESSORS.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong> — {s.purpose} ({s.location}).
            </li>
          ))}
        </ul>
        <p>
          Todos os subcontratantes estão obrigados, contratualmente, a tratar os
          seus dados em conformidade com o RGPD.
        </p>
      </Section>

      <Section title="7. Transferências internacionais">
        <p>
          Quando possível, escolhemos infraestrutura sediada na União Europeia.
          Algumas componentes (como o alojamento na Vercel) podem envolver
          transferências para países fora do EEE. Estas transferências são
          protegidas por mecanismos de transferência reconhecidos (Cláusulas
          Contratuais-Tipo da Comissão Europeia).
        </p>
      </Section>

      <Section title="8. Os seus direitos">
        <p>Ao abrigo do RGPD, tem o direito de:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Aceder aos seus dados pessoais.</li>
          <li>Solicitar a sua retificação ou atualização.</li>
          <li>Solicitar a sua eliminação (&quot;direito ao esquecimento&quot;).</li>
          <li>Solicitar a limitação ou oposição ao tratamento.</li>
          <li>Solicitar a portabilidade dos seus dados.</li>
          <li>Retirar o consentimento, quando aplicável.</li>
        </ul>
        <p>
          Para exercer qualquer destes direitos, contacte-nos em{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-primary hover:underline"
          >
            {COMPANY.contactEmail}
          </a>
          . Tem também o direito de apresentar reclamação à{" "}
          <strong>Comissão Nacional de Proteção de Dados (CNPD)</strong> em{" "}
          <a
            href="https://www.cnpd.pt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            www.cnpd.pt
          </a>
          .
        </p>
      </Section>

      <Section title="9. Segurança">
        <p>
          Implementamos medidas técnicas e organizativas para proteger os seus
          dados, incluindo encriptação em trânsito (TLS) e em repouso, controlo de
          acessos por papel, isolamento por cliente (multi-tenant) e cópias de
          segurança regulares.
        </p>
      </Section>

      <Section title="10. Cookies">
        <p>
          Para informação sobre cookies utilizados no nosso site, consulte a nossa{" "}
          <Link href="/politica-de-cookies" className="text-primary hover:underline">
            Política de Cookies
          </Link>
          .
        </p>
      </Section>

      <Section title="11. Alterações a esta política">
        <p>
          Podemos atualizar esta política. A versão em vigor é sempre a publicada
          nesta página, com a data da última atualização indicada no topo.
          Alterações materiais serão comunicadas aos utilizadores através do email
          associado à sua conta.
        </p>
      </Section>
    </LegalPage>
  );
}
