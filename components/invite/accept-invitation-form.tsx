"use client";

import { useActionState } from "react";
import { acceptInvitationAction, type ActionState } from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    acceptInvitationAction,
    null
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" className="w-full" loading={pending}>
        Aceptar invitación
      </Button>
    </form>
  );
}
