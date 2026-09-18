import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Iniciar sesión — Flowbase" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Bienvenido de vuelta</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Inicia sesión para continuar gestionando tus proyectos.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
