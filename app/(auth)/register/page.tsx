import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Crear cuenta — Flowbase" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Crea tu cuenta</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Empieza a organizar tus proyectos en minutos.
      </p>
      <RegisterForm />
    </div>
  );
}
