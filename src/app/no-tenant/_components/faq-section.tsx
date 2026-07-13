import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./landing/_primitives";

export type Faq = {
  question: string;
  answer: string;
};

/**
 * Visible FAQ accordion + matching `FAQPage` JSON-LD, both rendered from the
 * same `faqs` array so the structured data always mirrors the on-page text
 * (Google requires the schema to match what the user sees). Uses native
 * `<details>/<summary>`: accessible and keyboard-operable without extra JS.
 */
export function FaqSection({ faqs }: { faqs: Faq[] }) {
  if (faqs.length === 0) return null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <section id="faq" className="relative overflow-hidden py-14 md:py-20">
      <div className="relative mx-auto max-w-3xl px-6">
        <SectionHeading title="Perguntas" accent="frequentes" />
        <ul className="space-y-3">
          {faqs.map((f) => (
            <li key={f.question}>
              <details className="group rounded-2xl border border-[var(--landing-forest)]/10 bg-white shadow-sm shadow-[var(--landing-forest)]/5 transition-colors open:border-[var(--landing-forest)]/20">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left font-semibold text-[var(--landing-ink)] [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <ChevronDown
                    aria-hidden
                    className="h-5 w-5 shrink-0 text-[var(--landing-forest)] transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">
                  {f.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </section>
  );
}
