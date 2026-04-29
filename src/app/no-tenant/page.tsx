import type { Metadata } from "next";
import { LandingPage } from "./_components/landing-page";

const TITLE = "Convlyx · Software de gestão para escolas de condução";
const DESCRIPTION =
  "Plataforma multi-tenant para escolas de condução em Portugal. Gestão de aulas, alunos, instrutores, presenças, calendário e notificações push — tudo numa só aplicação.";
const URL = "https://convlyx.com";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "escola de condução",
    "software escola condução",
    "gestão escola condução",
    "carta de condução",
    "agenda aulas condução",
    "código da estrada",
    "instrutores",
    "Portugal",
    "SaaS",
  ],
  authors: [{ name: "Convlyx" }],
  alternates: {
    canonical: URL,
  },
  openGraph: {
    type: "website",
    url: URL,
    siteName: "Convlyx",
    title: TITLE,
    description: DESCRIPTION,
    locale: "pt_PT",
    images: [
      {
        url: `${URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Convlyx — gestão para escolas de condução",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Convlyx",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: DESCRIPTION,
            url: URL,
            inLanguage: "pt-PT",
            offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
            publisher: {
              "@type": "Organization",
              name: "Convlyx",
              url: URL,
            },
          }),
        }}
      />
      <LandingPage />
    </>
  );
}
