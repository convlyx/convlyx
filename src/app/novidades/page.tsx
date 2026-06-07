import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Newspaper } from "lucide-react";
import { getAllPosts } from "@/lib/novidades";
import { SiteFooter } from "../no-tenant/_components/site-footer";
import { BlogNav } from "./_components/blog-nav";

const URL = "https://convlyx.com/novidades";
const TITLE = "Novidades · Convlyx";
const DESCRIPTION =
  "As últimas novidades e melhorias do Convlyx — o software de gestão para escolas de condução. Acompanhe cada nova funcionalidade.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: "website",
    url: URL,
    siteName: "Convlyx",
    title: TITLE,
    description: DESCRIPTION,
    locale: "pt_PT",
  },
  robots: { index: true, follow: true },
};

export default async function NovidadesIndexPage() {
  const t = await getTranslations("novidades");
  const format = await getFormatter();
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background">
      <BlogNav backLabel={t("backToHome")} />

      <main className="mx-auto max-w-3xl px-6 pt-28 pb-16">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Newspaper className="h-3.5 w-3.5" />
            {t("kicker")}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-3 text-muted-foreground text-lg">{t("blogSubtitle")}</p>
        </div>

        {posts.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/novidades/${post.slug}`}
                  className="group block rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                >
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
                  <h2 className="mt-1.5 text-xl font-semibold group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  {post.summary && (
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {post.summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
