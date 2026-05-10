import type { MetadataRoute } from "next";

const ROOT = "https://convlyx.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: ROOT,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${ROOT}/software-escola-conducao`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${ROOT}/calendario-aulas-conducao`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${ROOT}/gestao-alunos-conducao`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${ROOT}/politica-de-privacidade`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${ROOT}/termos-e-condicoes`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${ROOT}/politica-de-cookies`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
