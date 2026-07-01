import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/novidades";

const ROOT = "https://convlyx.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const novidades: MetadataRoute.Sitemap = [
    {
      url: `${ROOT}/novidades`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...getAllPosts().map((post) => ({
      url: `${ROOT}/novidades/${post.slug}`,
      lastModified: new Date(`${post.date}T00:00:00.000Z`),
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  ];

  return [
    ...novidades,
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
    {
      url: `${ROOT}/contrato-de-subcontratacao`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
