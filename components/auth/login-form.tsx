"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInAction, type AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    signInAction,
    null
  );
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/projects";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" name="email" type="email" placeholder="tu@correo.com" required autoFocus />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
      </div>

      <Button type="submit" className="w-full" loading={pending}>
        Iniciar sesión
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-primary font-medium hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
