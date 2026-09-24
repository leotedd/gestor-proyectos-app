"use client";

import { useActionState } from "react";
import { acceptInvitationAsGuestAction, type GuestActionState } from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function GuestInviteForm({ token, defaultEmail }: { token: string; defaultEmail: string }) {
  const [state, action, pending] = useActionState<GuestActionState, FormData>(
    acceptInvitationAsGuestAction,
    null
  );

  return (
    <form action={action} className="space-y-4 text-left">
      <input type="hidden" name="token" value={token} />
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input id="fullName" name="fullName" required autoFocus placeholder="Tu nombre y apellido" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          placeholder="tu@correo.com"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username">Nombre de usuario</Label>
        <Input id="username" name="username" placeholder="Opcional" />
      </div>

      <Button type="submit" className="w-full" loading={pending}>
        Ingresar al proyecto
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        No necesitas contraseña. Esta es una sesión temporal de acceso al proyecto.
      </p>
    </form>
  );
}
