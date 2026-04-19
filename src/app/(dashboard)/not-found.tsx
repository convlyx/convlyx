import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="text-center space-y-4">
        <p className="text-7xl font-bold text-primary">404</p>
        <h1 className="text-xl font-semibold">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          A página que procura não existe ou foi movida.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
