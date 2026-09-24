"use client";

import { useActionState, useState } from "react";
import { UserPlus, Copy, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { createInvitationAction, type ActionState } from "@/app/actions/invitations";

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Portapapeles no disponible: el enlace sigue visible para copiar a mano.
        }
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Enlace copiado" : "Copiar enlace"}
    </Button>
  );
}

export function InviteMemberModal({
  projectId,
  trigger,
  title = "Invitar miembro",
  description = "Genera un enlace de invitación para compartir por el medio que prefieras.",
}: {
  projectId: string;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createInvitationAction,
    null
  );

  // stopPropagation: en /projects, este disparador vive dentro de la
  // tarjeta del proyecto (un <Link> completo); sin esto, el clic también
  // navegaría a abrir el proyecto en vez de solo abrir el modal.
  return (
    <>
      <span
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
      >
        {trigger ?? (
          <Button size="sm" type="button">
            <UserPlus className="h-4 w-4" /> Invitar miembro
          </Button>
        )}
      </span>

      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          {state?.error && <Alert tone="danger">{state.error}</Alert>}
          {state?.success && <Alert tone="success">{state.success}</Alert>}

          {state?.link && (
            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Enlace de invitación
              </p>
              <p className="text-xs text-foreground break-all">{state.link}</p>
              <CopyLinkButton link={state.link} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" name="email" type="email" required placeholder="persona@correo.com" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Rol</Label>
            <Select id="role" name="role" defaultValue="MEMBER">
              <option value="MEMBER">Miembro — puede trabajar sobre las tareas que tenga asignadas</option>
              <option value="VIEWER">Observador / Solo vista — puede consultar el proyecto sin realizar modificaciones</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button type="submit" loading={pending}>
              Generar invitación
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
