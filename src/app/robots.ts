import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const ROOT_DOMAIN = "convlyx.com";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const isRoot = host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`;

  if (!isRoot) {
    // Tenant subdomains and platform admin: block all crawlers
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  // Marketing site
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: `https://${ROOT_DOMAIN}/sitemap.xml`,
    host: `https://${ROOT_DOMAIN}`,
  };
}
