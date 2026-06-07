import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAllPosts, getPostBySlug } from "@/lib/novidades";
import { NovidadesMarkdown } from "@/components/novidades-markdown";
import { SiteFooter } from "../../no-tenant/_components/site-footer";
import { BlogNav } from "../_components/blog-nav";

const BASE_URL = "https://convlyx.com/novidades";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const url = `${BASE_URL}/${post.slug}`;
  const title = `${post.title} · Novidades Convlyx`;
  return {
    title,
    description: post.summary,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "Convlyx",
      title,
      description: post.summary,
      locale: "pt_PT",
      publishedTime: post.date,
      ...(post.cover ? { images: [{ url: post.cover }] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export default async function NovidadesPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const t = await getTranslations("novidades");
  const format = await getFormatter();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    inLanguage: "pt-PT",
    url: `${BASE_URL}/${post.slug}`,
    publisher: {
      "@type": "Organization",
      name: "Convlyx",
      logo: "https://convlyx.com/favicon.png",
    },
    ...(post.cover ? { image: `https://convlyx.com${post.cover}` } : {}),
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <BlogNav backLabel={t("backToList")} backHref="/novidades" />

      <main className="mx-auto max-w-3xl px-6 pt-28 pb-16">
        <article>
          <header className="mb-8">
            <time
              dateTime={post.date}
              className="text-xs font-medium uppercase tracking-wide text-primary"
            >
              {format.dateTime(new Date(`${post.date}T00:00:00`), {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{post.title}</h1>
          </header>

          {post.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover}
              alt={post.title}
              className="mb-8 w-full rounded-2xl border shadow-sm"
            />
          )}

          <NovidadesMarkdown>{post.body}</NovidadesMarkdown>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
