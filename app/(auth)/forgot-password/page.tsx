import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Recuperar contraseña — Flowbase" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Recuperar contraseña</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Te enviaremos un enlace para restablecerla.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
