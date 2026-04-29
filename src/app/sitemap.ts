import type { MetadataRoute } from "next";

const ROOT = "https://convlyx.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: ROOT,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
