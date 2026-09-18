"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { updateProjectAction, type ActionState } from "@/app/actions/projects";
import type { ProjectRow } from "@/lib/types/database";

export function ProjectSettingsForm({ project }: { project: ProjectRow }) {
  const action = updateProjectAction.bind(null, project.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={project.name} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="key">Prefijo</Label>
        <Input id="key" name="key" defaultValue={project.key} className="uppercase" maxLength={10} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" rows={4} defaultValue={project.description} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Fecha inicio</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={project.start_date ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Fecha fin</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={project.end_date ?? ""} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">Estado</Label>
        <Select id="status" name="status" defaultValue={project.status}>
          <option value="ACTIVE">Activo</option>
          <option value="ON_HOLD">En pausa</option>
          <option value="COMPLETED">Completado</option>
          <option value="ARCHIVED">Archivado</option>
        </Select>
      </div>

      <Button type="submit" loading={pending}>
        <Save className="h-4 w-4" /> Guardar cambios
      </Button>
    </form>
  );
}
