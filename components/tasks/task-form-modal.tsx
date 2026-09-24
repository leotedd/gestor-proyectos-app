"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { createTaskAction, updateTaskAction, type ActionState } from "@/app/actions/tasks";
import type { AreaRow, ProjectRole, TaskStatus } from "@/lib/types/database";
import type { TaskWithRelations } from "@/lib/tasks/types";
import { TaskLinksSection } from "@/components/tasks/task-links-section";

interface MemberOption {
  id: string;
  name: string;
}

const initialState: ActionState = null;
const MANAGER_ROLES: ProjectRole[] = ["OWNER", "ADMIN"];

export function TaskFormModal({
  projectId,
  areas,
  members,
  task,
  role,
  currentUserId,
  trigger,
  defaultStatus,
  open: controlledOpen,
  onOpenChange,
}: {
  projectId: string;
  areas: AreaRow[];
  members: MemberOption[];
  task?: TaskWithRelations;
  role: ProjectRole;
  currentUserId: string;
  trigger?: React.ReactNode;
  defaultStatus?: string;
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

  // Quién puede qué en ESTE formulario (la Server Action vuelve a
  // comprobar todo esto server-side; esto solo controla la UI):
  //  - PROPIETARIO (y ADMIN, técnico): cualquier campo, cualquier tarea.
  //  - MIEMBRO en una tarea SUYA: solo estado, progreso y fecha límite.
  //  - MIEMBRO en una tarea ajena, u OBSERVADOR: solo lectura, sin guardar.
  const isManager = MANAGER_ROLES.includes(role);
  const isOwnTask = !!task && task.assignee?.id === currentUserId;
  const canSubmit = !task ? isManager : isManager || isOwnTask;
  const fieldsLocked = !isManager; // título/descripción/área/responsable/prioridad/etiquetas/fecha inicio

  const action = task ? updateTaskAction : createTaskAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    initialState
  );

  const [status, setStatus] = useState<TaskStatus>(task?.status ?? (defaultStatus as TaskStatus) ?? "TODO");
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const displayProgress = status === "DONE" ? 100 : progress;

  useEffect(() => {
    // Cierra el modal cuando el Server Action reporta éxito. No hay un
    // manejador de evento síncrono al que enganchar esto: `useActionState`
    // resuelve de forma asíncrona, así que un Effect es la vía correcta.
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
              <Plus className="h-4 w-4" /> Nueva tarea
            </Button>
          )}
        </span>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={task ? `${canSubmit ? "Editar" : "Ver"} ${task.code}` : "Nueva tarea"}
        description={
          !task
            ? undefined
            : canSubmit && !isManager
              ? "Puedes actualizar el estado, el progreso y la fecha límite de tu tarea."
              : !canSubmit
                ? "Solo puedes consultar esta tarea: no está asignada a ti."
                : undefined
        }
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          {task && <input type="hidden" name="taskId" value={task.id} />}
          {state?.error && <Alert tone="danger">{state.error}</Alert>}
          {!canSubmit && task && <Alert tone="info">Vista de solo lectura.</Alert>}

          <div className="space-y-1.5">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={task?.title}
              autoFocus={!fieldsLocked}
              disabled={fieldsLocked}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={task?.description}
              disabled={fieldsLocked}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="areaId">Área</Label>
              <Select id="areaId" name="areaId" defaultValue={task?.area?.id ?? ""} disabled={fieldsLocked}>
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assigneeId">Responsable</Label>
              <Select
                id="assigneeId"
                name="assigneeId"
                defaultValue={task?.assignee?.id ?? ""}
                disabled={fieldsLocked}
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="priority">Prioridad</Label>
              <Select id="priority" name="priority" defaultValue={task?.priority ?? "MEDIUM"} disabled={fieldsLocked}>
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Estado</Label>
              <Select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                disabled={!canSubmit}
              >
                <option value="TODO">Por hacer</option>
                <option value="IN_PROGRESS">En progreso</option>
                <option value="REVIEW">En revisión</option>
                <option value="DONE">Completado</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Fecha inicio</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={task?.start_date ?? ""}
                disabled={fieldsLocked}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Fecha límite</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={task?.due_date ?? ""}
                disabled={!canSubmit}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="progress">Progreso ({displayProgress}%)</Label>
            <Input
              id="progress"
              name="progress"
              type="range"
              min={0}
              max={100}
              step={5}
              value={displayProgress}
              onChange={(e) => setProgress(Number(e.target.value))}
              disabled={!canSubmit || status === "DONE"}
            />
            {status === "DONE" && canSubmit && (
              <p className="text-xs text-muted-foreground">
                Una tarea completada siempre queda en 100% de progreso.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="labels">Etiquetas (separadas por coma)</Label>
            <Input
              id="labels"
              name="labels"
              defaultValue={task?.labels?.join(", ")}
              placeholder="frontend, urgente"
              disabled={fieldsLocked}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {canSubmit ? "Cancelar" : "Cerrar"}
            </Button>
            {canSubmit && (
              <Button type="submit" loading={pending}>
                {task ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {task ? "Guardar cambios" : "Crear tarea"}
              </Button>
            )}
          </div>
        </form>
        {task ? (
          <TaskLinksSection key={task.id} projectId={projectId} taskId={task.id} />
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">Para agregar enlaces, crea la tarea y luego abre su edición.</p>
        )}
      </Modal>
    </>
  );
}
