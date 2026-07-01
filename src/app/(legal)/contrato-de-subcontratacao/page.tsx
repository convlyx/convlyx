import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection as Section } from "../_components/legal-page";
import { COMPANY, formatLegalEntity } from "@/lib/company";
import { LEGAL_VERSIONS, SUBPROCESSORS } from "@/lib/legal";

const URL = "https://convlyx.com/contrato-de-subcontratacao";
const TITLE = "Contrato de Subcontratação (DPA) | Convlyx";
const DESCRIPTION =
  "Contrato de subcontratação de tratamento de dados pessoais (Art. 28.º RGPD) entre a escola de condução (responsável) e o Convlyx (subcontratante).";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <LegalPage title="Contrato de Subcontratação (DPA)" lastUpdated={LEGAL_VERSIONS.dpa}>
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground/80">
        Este documento é uma minuta e <strong>carece de revisão jurídica</strong> antes
        de ser considerado definitivo.
      </div>

      <Section title="1. Enquadramento e definições">
        <p>
          O presente Contrato de Subcontratação (&quot;DPA&quot;) regula o tratamento de
          dados pessoais efetuado por <strong>{formatLegalEntity()}</strong> (&quot;Convlyx&quot;,
          o subcontratante) por conta da escola de condução Cliente (o responsável pelo
          tratamento), ao abrigo do artigo 28.º do Regulamento (UE) 2016/679 (RGPD) e da
          Lei n.º 58/2019. Faz parte integrante dos{" "}
          <Link href="/termos-e-condicoes" className="text-primary hover:underline">
            Termos e Condições
          </Link>{" "}
          e é aceite com eles.
        </p>
      </Section>

      <Section title="2. Objeto, duração, natureza e finalidade">
        <p>
          O Convlyx trata dados pessoais exclusivamente para prestar o serviço de gestão
          da escola de condução (agenda de aulas, alunos, instrutores, exames, presenças,
          notificações). O tratamento dura enquanto vigorar o contrato de prestação de
          serviço e cessa nos termos da cláusula 9.
        </p>
      </Section>

      <Section title="3. Tipos de dados e categorias de titulares">
        <p>
          Dados de identificação e contacto (nome, email, telefone), dados de percurso
          formativo (aulas, presenças, exames, categorias de carta) e dados de conta.
          Titulares: alunos, instrutores e colaboradores da escola Cliente.
        </p>
      </Section>

      <Section title="4. Instruções documentadas">
        <p>
          O Convlyx trata os dados apenas de acordo com instruções documentadas do
          responsável, incluindo as constantes destes documentos, salvo obrigação legal
          da União ou de Portugal.
        </p>
      </Section>

      <Section title="5. Confidencialidade">
        <p>
          As pessoas autorizadas a tratar os dados estão sujeitas a dever de
          confidencialidade.
        </p>
      </Section>

      <Section title="6. Segurança (Art. 32.º)">
        <p>
          O Convlyx aplica medidas técnicas e organizativas adequadas: isolamento de
          dados por escola (multi-tenant), encriptação em trânsito e em repouso, controlo
          de acessos por função, registo de auditoria e alojamento em infraestrutura
          europeia.
        </p>
      </Section>

      <Section title="7. Subcontratantes autorizados">
        <p>O Cliente autoriza os seguintes subcontratantes ulteriores:</p>
        <ul className="list-disc pl-6 space-y-2">
          {SUBPROCESSORS.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong> — {s.purpose} ({s.location}).
            </li>
          ))}
        </ul>
        <p>
          O Convlyx informa o Cliente de alterações à lista com antecedência razoável,
          permitindo oposição fundamentada.
        </p>
      </Section>

      <Section title="8. Transferências internacionais">
        <p>
          Quando um subcontratante implique tratamento fora do Espaço Económico Europeu,
          a transferência é enquadrada por garantias adequadas nos termos do Capítulo V do
          RGPD, designadamente Cláusulas Contratuais-Tipo (CCP/SCC).
        </p>
      </Section>

      <Section title="9. Assistência ao responsável">
        <p>
          O Convlyx assiste o Cliente no cumprimento dos pedidos de exercício de direitos
          dos titulares, na notificação de violações de dados e na realização de
          avaliações de impacto, na medida da sua função como subcontratante.
        </p>
      </Section>

      <Section title="10. Eliminação ou devolução">
        <p>
          Cessado o serviço, os dados do Cliente ficam disponíveis para exportação durante
          30 dias, sendo depois eliminados, sem prejuízo de prazos legais de conservação.
        </p>
      </Section>

      <Section title="11. Auditorias">
        <p>
          O Convlyx disponibiliza a informação necessária para demonstrar o cumprimento do
          artigo 28.º e permite auditorias razoáveis, com pré-aviso, mediante acordo.
        </p>
      </Section>

      <Section title="12. Contacto">
        <p>
          Questões sobre este DPA:{" "}
          <a href={`mailto:${COMPANY.contactEmail}`} className="text-primary hover:underline">
            {COMPANY.contactEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
