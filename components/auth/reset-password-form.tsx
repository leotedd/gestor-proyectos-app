"use client";

import { useActionState } from "react";
import { updatePasswordAction, type AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    updatePasswordAction,
    null
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoFocus />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
      </div>

      <Button type="submit" className="w-full" loading={pending}>
        Guardar nueva contraseña
      </Button>
    </form>
  );
}
