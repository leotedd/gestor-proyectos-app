"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { createAreaAction, updateAreaAction, type ActionState } from "@/app/actions/areas";
import type { AreaRow } from "@/lib/types/database";

export function AreaFormModal({
  projectId,
  area,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  projectId: string;
  area?: AreaRow;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled) onOpenChange?.(value);
    else setInternalOpen(value);
  };

  const action = area
    ? updateAreaAction.bind(null, area.id, projectId)
    : createAreaAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  useEffect(() => {
    // Cierra el modal cuando el Server Action reporta éxito (ver
    // justificación en components/tasks/task-form-modal.tsx).
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      {!isControlled && (
        <span onClick={() => setOpen(true)} className="contents cursor-pointer">
          {trigger ?? (
            <Button size="sm">
              <Plus className="h-4 w-4" /> Nueva área
            </Button>
          )}
        </span>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={area ? "Editar área" : "Nueva área"}>
        <form action={formAction} className="space-y-4">
          {!area && <input type="hidden" name="projectId" value={projectId} />}
          {state?.error && <Alert tone="danger">{state.error}</Alert>}

          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required defaultValue={area?.name} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={area?.description} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {area ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {area ? "Guardar" : "Crear área"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
