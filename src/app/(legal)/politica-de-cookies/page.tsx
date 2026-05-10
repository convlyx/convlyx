import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../_components/legal-page";

const URL = "https://convlyx.com/politica-de-cookies";
const TITLE = "Política de Cookies | Convlyx";
const DESCRIPTION =
  "Política de cookies do Convlyx — software de gestão para escolas de condução. Saiba que cookies utilizamos e como geri-los.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <LegalPage title="Política de Cookies" lastUpdated="2026-05-08">
      <Section title="1. O que são cookies">
        <p>
          Cookies são pequenos ficheiros de texto que um site coloca no seu
          dispositivo quando o visita. Permitem que o site reconheça o seu
          dispositivo em visitas futuras, guarde preferências ou recolha
          estatísticas de utilização agregadas. Tecnologias semelhantes
          (e.g. localStorage, identificadores de dispositivo) são abrangidas por
          esta política.
        </p>
      </Section>

      <Section title="2. Cookies que utilizamos">
        <p>O Convlyx utiliza três categorias de cookies:</p>

        <h3 className="text-base md:text-lg font-semibold mt-6">Cookies estritamente necessários</h3>
        <p>
          Indispensáveis para o funcionamento da plataforma. Sem eles não é
          possível autenticar-se ou utilizar funcionalidades essenciais. Não
          requerem consentimento.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Sessão e autenticação</strong> (Supabase): manter a sua sessão iniciada.</li>
          <li><strong>Preferências da aplicação</strong>: idioma e configurações da escola.</li>
          <li><strong>Segurança</strong>: prevenção de ataques (e.g. CSRF).</li>
        </ul>

        <h3 className="text-base md:text-lg font-semibold mt-6">Cookies analíticos</h3>
        <p>
          Ajudam-nos a perceber como os utilizadores navegam na plataforma e a
          melhorá-la. Só são instalados com o seu consentimento.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>PostHog</strong>: análise de utilização agregada (páginas
            visitadas, fluxos, eventos). Servidores na União Europeia. Política
            de privacidade em{" "}
            <a
              href="https://posthog.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              posthog.com/privacy
            </a>
            .
          </li>
          <li>
            <strong>Vercel Analytics</strong>: métricas anónimas de desempenho da
            página (não utiliza cookies persistentes; baseia-se em dados
            agregados sem identificação do utilizador).
          </li>
        </ul>

        <h3 className="text-base md:text-lg font-semibold mt-6">Cookies de terceiros</h3>
        <p>
          O Convlyx não utiliza cookies de publicidade nem partilha dados com
          redes de anunciantes. Quando carregamos conteúdos externos (e.g.
          imagens), esses serviços podem registar a sua visita ao abrigo das
          respetivas políticas.
        </p>
      </Section>

      <Section title="3. Como gerir cookies">
        <p>
          Pode aceitar ou recusar cookies não essenciais a qualquer momento.
          Adicionalmente, pode configurar o seu navegador para bloquear ou
          eliminar cookies. Note que recusar cookies estritamente necessários
          pode impedir o funcionamento da plataforma.
        </p>
        <p>
          Instruções por navegador:{" "}
          <a
            href="https://support.google.com/chrome/answer/95647"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Chrome
          </a>
          ,{" "}
          <a
            href="https://support.mozilla.org/pt-PT/kb/Activar%20e%20desactivar%20cookies"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Firefox
          </a>
          ,{" "}
          <a
            href="https://support.apple.com/pt-pt/guide/safari/sfri11471/mac"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Safari
          </a>
          ,{" "}
          <a
            href="https://support.microsoft.com/pt-pt/microsoft-edge/eliminar-cookies-no-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Edge
          </a>
          .
        </p>
      </Section>

      <Section title="4. Mais informação">
        <p>
          Para detalhes sobre o tratamento dos seus dados pessoais, consulte a
          nossa{" "}
          <Link href="/politica-de-privacidade" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </Section>

      <Section title="5. Alterações a esta política">
        <p>
          Esta política pode ser atualizada. A versão em vigor é sempre a
          publicada nesta página, com a data da última atualização indicada no
          topo.
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
