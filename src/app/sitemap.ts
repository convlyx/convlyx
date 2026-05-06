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
  ];
}
