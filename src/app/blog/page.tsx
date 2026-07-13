import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter } from "next-intl/server";
import { ArrowRight, Clock } from "lucide-react";
import { getAllArticles } from "./_articles";
import { BlogNav } from "../novidades/_components/blog-nav";
import { SiteFooter } from "../no-tenant/_components/site-footer";

const URL = "https://convlyx.com/blog";
const TITLE = "Blog de gestão de escolas de condução | Convlyx";
const DESCRIPTION =
  "Guias e conselhos práticos para gerir uma escola de condução em Portugal: custos, organização, exames do IMT e digitalização.";

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
    images: ["https://convlyx.com/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["https://convlyx.com/og-image.png"],
  },
};

export default async function BlogIndexPage() {
  const articles = getAllArticles();
  const format = await getFormatter();

  return (
    <div className="min-h-screen bg-background">
      <BlogNav backLabel="Início" backHref="/" />

      <main className="mx-auto max-w-3xl px-6 pt-28 pb-16">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Blog</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Guias práticos para quem gere (ou está a pensar abrir) uma escola de condução em
            Portugal.
          </p>
        </header>

        <ul className="space-y-5">
          {articles.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/blog/${a.slug}`}
                className="group block rounded-2xl border border-primary/10 bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium uppercase tracking-wide text-primary">
                  <time dateTime={a.date}>
                    {format.dateTime(new Date(`${a.date}T00:00:00`), {
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
                    {a.readingMinutes} min
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                  {a.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.excerpt}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Ler artigo
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
