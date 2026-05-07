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

  // Marketing site — allow standard search bots and the major AI crawlers
  // explicitly so we can be cited by ChatGPT, Claude, Perplexity, Google
  // Gemini, etc. The wildcard rule would already cover them, but listing
  // each one makes our intent explicit and surfaces in audits.
  const allowAll = { allow: "/", disallow: ["/api/", "/_next/"] };
  const aiCrawlers = [
    "GPTBot", // OpenAI / ChatGPT
    "OAI-SearchBot", // OpenAI search
    "ChatGPT-User",
    "ClaudeBot", // Anthropic
    "Claude-Web",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended", // Google Gemini training
    "GoogleOther",
    "Applebot-Extended",
    "CCBot", // Common Crawl (training data for many models)
    "Bytespider", // ByteDance
    "Amazonbot",
  ];
  return {
    rules: [
      { userAgent: "*", ...allowAll },
      ...aiCrawlers.map((userAgent) => ({ userAgent, ...allowAll })),
    ],
    sitemap: `https://${ROOT_DOMAIN}/sitemap.xml`,
    host: `https://${ROOT_DOMAIN}`,
  };
}
