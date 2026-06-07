import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Minimal top bar for the public Novidades blog — logo home + a back link. */
export function BlogNav({ backLabel, backHref = "/" }: { backLabel: string; backHref?: string }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-primary/5">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-500 shadow-md shadow-primary/20">
            <img src="/favicon.png" alt="Convlyx" width={22} height={22} className="brightness-0 invert" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
            Convlyx
          </span>
        </Link>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      </div>
    </nav>
  );
}
