import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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

export default async function Page() {
  const t = await getTranslations("landing");
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      "@type": "Question",
      name: t(`faqQ${n}` as never),
      acceptedAnswer: {
        "@type": "Answer",
        text: t(`faqA${n}` as never),
      },
    })),
  };

  // Multiple JSON-LD blocks: Organization (brand identity, helps Google
  // recognize "Convlyx" as a name and not a typo), WebSite (canonical site
  // entry), and SoftwareApplication (the product). `alternateName` and
  // `sameAs` are the strongest signals against the "Convex" autocorrect.
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${URL}#organization`,
    name: "Convlyx",
    alternateName: ["Convlyx SaaS", "Convlyx Driving School Software"],
    url: URL,
    logo: `${URL}/favicon.png`,
    description: DESCRIPTION,
    inLanguage: "pt-PT",
    // Replace these with real profile URLs once they exist; even placeholders
    // help Google associate the brand if the URLs eventually resolve.
    sameAs: [
      // "https://www.linkedin.com/company/convlyx",
      // "https://twitter.com/convlyx",
      // "https://www.instagram.com/convlyx",
      // "https://www.facebook.com/convlyx",
    ].filter(Boolean),
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${URL}#website`,
    url: URL,
    name: "Convlyx",
    inLanguage: "pt-PT",
    publisher: { "@id": `${URL}#organization` },
  };

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Convlyx",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: DESCRIPTION,
    url: URL,
    inLanguage: "pt-PT",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    publisher: { "@id": `${URL}#organization` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <LandingPage />
    </>
  );
}
