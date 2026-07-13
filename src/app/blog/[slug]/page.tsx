import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter } from "next-intl/server";
import { ChevronRight, Clock } from "lucide-react";
import { getAllArticles, getArticleBySlug } from "../_articles";
import { NovidadesMarkdown } from "@/components/novidades-markdown";
import { BlogNav } from "../../novidades/_components/blog-nav";
import { SiteFooter } from "../../no-tenant/_components/site-footer";
import { ArticleCta } from "../_components/article-cta";

const BASE_URL = "https://convlyx.com/blog";

export function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  const url = `${BASE_URL}/${article.slug}`;
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "Convlyx",
      title: article.title,
      description: article.description,
      locale: "pt_PT",
      publishedTime: article.date,
      images: ["https://convlyx.com/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: ["https://convlyx.com/og-image.png"],
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const format = await getFormatter();
  const url = `${BASE_URL}/${article.slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.date,
    inLanguage: "pt-PT",
    url,
    image: "https://convlyx.com/og-image.png",
    author: { "@type": "Organization", name: "Convlyx", url: "https://convlyx.com" },
    publisher: {
      "@type": "Organization",
      name: "Convlyx",
      logo: {
        "@type": "ImageObject",
        url: "https://convlyx.com/favicon.png",
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: "https://convlyx.com" },
      { "@type": "ListItem", position: 2, name: "Blog", item: BASE_URL },
      { "@type": "ListItem", position: 3, name: article.title, item: url },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <BlogNav backLabel="Blog" backHref="/blog" />

      <main className="mx-auto max-w-3xl px-6 pt-28 pb-16">
        <article>
          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium uppercase tracking-wide text-primary">
              <time dateTime={article.date}>
                {format.dateTime(new Date(`${article.date}T00:00:00`), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {article.readingMinutes} min de leitura
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{article.title}</h1>
          </header>

          <NovidadesMarkdown>{article.body}</NovidadesMarkdown>

          <ArticleCta />
        </article>

        {article.related.length > 0 && (
          <section className="mt-12 border-t pt-10">
            <h2 className="mb-6 text-lg font-bold text-foreground md:text-xl">Saiba mais</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {article.related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="group flex h-full items-start gap-3 rounded-2xl border border-primary/10 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {r.title}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{r.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
