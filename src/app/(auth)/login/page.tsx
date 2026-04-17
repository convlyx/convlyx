import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Escola de Condução</h1>
          <p className="text-muted-foreground text-sm">
            Inicie sessão para continuar
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
