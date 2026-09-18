"use client";

import { useMemo, useState } from "react";
import { Search, Pencil, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteTaskAction } from "@/app/actions/tasks";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { TaskWithRelations } from "@/lib/tasks/types";
import type { AreaRow } from "@/lib/types/database";
import { ListChecks } from "lucide-react";

export function TasksTable({
  projectId,
  tasks,
  areas,
  members,
  canEdit,
  canManage,
}: {
  projectId: string;
  tasks: TaskWithRelations[];
  areas: AreaRow[];
  members: { id: string; name: string }[];
  canEdit: boolean;
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const { confirm, dialog } = useConfirm();

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (status && t.status !== status) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.code.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [tasks, search, status]);

  async function handleDelete(task: TaskWithRelations) {
    const ok = await confirm({
      title: `Eliminar ${task.code}`,
      description: `Se eliminará "${task.title}" permanentemente. Esta acción no se puede deshacer.`,
      danger: true,
    });
    if (!ok) return;
    await deleteTaskAction(task.id, projectId);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">Todos los estados</option>
          <option value="TODO">Por hacer</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="REVIEW">En revisión</option>
          <option value="DONE">Completado</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No hay tareas que coincidan"
          description="Ajusta los filtros o crea una nueva tarea."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Código</th>
                <th className="px-4 py-2.5 font-medium">Título</th>
                <th className="px-4 py-2.5 font-medium">Área</th>
                <th className="px-4 py-2.5 font-medium">Responsable</th>
                <th className="px-4 py-2.5 font-medium">Prioridad</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Vence</th>
                <th className="px-4 py-2.5 font-medium">Progreso</th>
                {canEdit && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-border last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {task.code}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-foreground max-w-64 truncate">
                    {task.title}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {task.area?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={task.assignee.full_name || task.assignee.email} size="sm" />
                        <span className="truncate max-w-32">
                          {task.assignee.full_name || task.assignee.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <TaskPriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-2.5">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 whitespace-nowrap",
                      isOverdue(task.due_date, task.status) ? "text-danger font-medium" : "text-muted-foreground"
                    )}
                  >
                    {formatDate(task.due_date)}
                  </td>
                  <td className="px-4 py-2.5 w-32">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {task.progress}%
                      </span>
                    </div>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingTask(task)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(task)}
                            aria-label="Eliminar"
                            className="text-danger hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingTask && (
        <TaskFormModal
          projectId={projectId}
          areas={areas}
          members={members}
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(v) => !v && setEditingTask(null)}
        />
      )}
      {dialog}
    </div>
  );
}
