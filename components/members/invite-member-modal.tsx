"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { createInvitationAction, type ActionState } from "@/app/actions/invitations";

export function InviteMemberModal({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createInvitationAction,
    null
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <UserPlus className="h-4 w-4" /> Invitar miembro
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invitar miembro"
        description="Se le enviará un correo con un enlace para unirse al proyecto."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          {state?.error && <Alert tone="danger">{state.error}</Alert>}
          {state?.success && <Alert tone="success">{state.success}</Alert>}

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" name="email" type="email" required placeholder="persona@correo.com" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Rol</Label>
            <Select id="role" name="role" defaultValue="MEMBER">
              <option value="ADMIN">Administrador — gestiona proyecto, miembros y tareas</option>
              <option value="MEMBER">Miembro — trabaja sobre tareas asignadas</option>
              <option value="VIEWER">Observador — solo lectura</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button type="submit" loading={pending}>
              Enviar invitación
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
