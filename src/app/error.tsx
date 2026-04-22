"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center space-y-4">
        <img src="/favicon.png" alt="" width={48} height={48} className="mx-auto" />
        <h1 className="text-xl font-semibold">Algo correu mal</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Ocorreu um erro inesperado. Tente novamente.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
