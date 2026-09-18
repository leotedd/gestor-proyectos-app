"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    requestPasswordResetAction,
    null
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" name="email" type="email" placeholder="tu@correo.com" required autoFocus />
      </div>

      <Button type="submit" className="w-full" loading={pending}>
        Enviar enlace de recuperación
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
