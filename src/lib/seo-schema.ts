/**
 * Shared JSON-LD nodes. The SEO landing pages reference the Organization via
 * `@id` (e.g. `Service.provider`); search engines only resolve that reference
 * when the Organization node is present on the same page, so we render this
 * alongside the page-specific schema.
 */
export const SITE_URL = "https://convlyx.com";

export const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}#organization`,
  name: "Convlyx",
  alternateName: ["Convlyx SaaS", "Convlyx Driving School Software"],
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  description:
    "Software de gestão para escolas de condução em Portugal: aulas, alunos, instrutores, presenças, calendário e notificações.",
  inLanguage: "pt-PT",
  sameAs: [
    "https://www.instagram.com/convlyx/",
    "https://www.facebook.com/profile.php?id=61589251470921",
  ],
} as const;
