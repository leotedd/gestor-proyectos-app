"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    signUpAction,
    null
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input id="fullName" name="fullName" placeholder="Ada Lovelace" required autoFocus />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" name="email" type="email" placeholder="tu@correo.com" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" placeholder="Mínimo 8 caracteres" required minLength={8} />
      </div>

      <Button type="submit" className="w-full" loading={pending}>
        Crear cuenta
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
