"use client";

import { useActionState, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { createProjectAction, type ActionState } from "@/app/actions/projects";
import { slugifyKey } from "@/lib/utils";

export function CreateProjectModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(() => searchParams.get("new") === "1");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createProjectAction,
    null
  );

  // Abre el modal si `?new=1` cambia (p. ej. al navegar desde el selector de
  // proyecto), ajustando el estado durante el render en vez de con un Effect.
  const currentNewParam = searchParams.get("new");
  const [lastNewParam, setLastNewParam] = useState(currentNewParam);
  if (currentNewParam !== lastNewParam) {
    setLastNewParam(currentNewParam);
    if (currentNewParam === "1") setOpen(true);
  }

  const close = () => {
    setOpen(false);
    if (searchParams.get("new")) router.replace("/projects");
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nuevo proyecto
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Crear proyecto"
        description="Define lo esencial; podrás editarlo después."
      >
        <form action={action} className="space-y-4">
          {state?.error && <Alert tone="danger">{state.error}</Alert>}

          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre del proyecto</Label>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(slugifyKey(e.target.value));
              }}
              placeholder="Ej. Rediseño Web Corporativo"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="key">Prefijo / clave</Label>
            <Input
              id="key"
              name="key"
              required
              value={key}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(e.target.value.toUpperCase());
              }}
              placeholder="Ej. WEB"
              maxLength={10}
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Se usará para generar códigos de tarea, ej. {key || "WEB"}-001
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Opcional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Fecha inicio</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Fecha fin</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Crear proyecto
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
