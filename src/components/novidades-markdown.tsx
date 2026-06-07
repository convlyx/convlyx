import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a Novidades post body (trusted, authored Markdown from the repo).
 * Styled with Tailwind arbitrary selectors rather than a typography plugin to
 * avoid a new dependency. Theme tokens only — no hardcoded colors.
 */
export function NovidadesMarkdown({ children }: { children: string }) {
  return (
    <div
      className="
        max-w-none text-[15px] leading-relaxed text-foreground/90
        [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground
        [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground
        [&_p]:my-4
        [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80
        [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5
        [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1.5
        [&_li]:pl-1
        [&_strong]:font-semibold [&_strong]:text-foreground
        [&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
        [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:font-mono
        [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_hr]:my-8 [&_hr]:border-border
        [&_img]:my-6 [&_img]:w-full [&_img]:rounded-xl [&_img]:border [&_img]:shadow-sm
        [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
        [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold
        [&_td]:border [&_td]:px-3 [&_td]:py-2
      "
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
