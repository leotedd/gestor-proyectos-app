import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Nueva contraseña — Flowbase" };

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Nueva contraseña</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Elige una nueva contraseña para tu cuenta.
      </p>
      <ResetPasswordForm />
    </div>
  );
}
