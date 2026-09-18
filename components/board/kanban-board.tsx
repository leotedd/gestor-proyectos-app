"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/board/kanban-column";
import { TaskCard } from "@/components/board/task-card";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { Alert } from "@/components/ui/alert";
import { moveTaskAction } from "@/app/actions/tasks";
import type { TaskWithRelations } from "@/lib/tasks/types";
import type { AreaRow } from "@/lib/types/database";

const COLUMNS: { id: TaskWithRelations["status"]; title: string; accent: string }[] = [
  { id: "TODO", title: "Por hacer", accent: "bg-slate-400" },
  { id: "IN_PROGRESS", title: "En progreso", accent: "bg-blue-500" },
  { id: "REVIEW", title: "En revisión", accent: "bg-amber-500" },
  { id: "DONE", title: "Completado", accent: "bg-emerald-500" },
];

export function KanbanBoard({
  projectId,
  initialTasks,
  areas,
  members,
  canEdit,
}: {
  projectId: string;
  initialTasks: TaskWithRelations[];
  areas: AreaRow[];
  members: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  // Sincroniza el estado local cuando el servidor revalida (nueva navegación
  // o `router.refresh()`) sin usar un Effect: se ajusta durante el render,
  // como recomienda React para "adjusting state when a prop changes".
  const [syncedInitialTasks, setSyncedInitialTasks] = useState(initialTasks);
  if (initialTasks !== syncedInitialTasks) {
    setSyncedInitialTasks(initialTasks);
    setTasks(initialTasks);
  }
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const columns = useMemo(() => {
    const map: Record<string, TaskWithRelations[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    };
    for (const task of tasks) {
      map[task.status]?.push(task);
    }
    return map;
  }, [tasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !canEdit) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overIsColumn = COLUMNS.some((c) => c.id === over.id);
    const overTask = tasks.find((t) => t.id === over.id);
    const destStatus = overIsColumn ? (over.id as TaskWithRelations["status"]) : overTask?.status;
    if (!destStatus) return;

    const previousTasks = tasks;
    const withoutActive = tasks.filter((t) => t.id !== active.id);
    const destItems = withoutActive.filter((t) => t.status === destStatus);
    const insertIndex = overTask
      ? destItems.findIndex((t) => t.id === over.id)
      : destItems.length;

    const updatedActive: TaskWithRelations = { ...activeTask, status: destStatus };
    destItems.splice(insertIndex === -1 ? destItems.length : insertIndex, 0, updatedActive);

    const newTasks = [
      ...withoutActive.filter((t) => t.status !== destStatus),
      ...destItems,
    ];
    setTasks(newTasks);

    const position = insertIndex === -1 ? destItems.length - 1 : insertIndex;
    startTransition(async () => {
      try {
        await moveTaskAction({
          taskId: activeTask.id,
          projectId,
          status: destStatus,
          position,
        });
      } catch (err) {
        setTasks(previousTasks);
        setError(err instanceof Error ? err.message : "No se pudo mover la tarea.");
      }
    });
  }

  return (
    <div className="px-6 py-4 space-y-3">
      {error && (
        <Alert tone="danger" className="max-w-xl">
          {error}
        </Alert>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              accentClass={col.accent}
              tasks={columns[col.id] ?? []}
              disabled={!canEdit}
              onTaskClick={setEditingTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} disabled /> : null}
        </DragOverlay>
      </DndContext>

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
    </div>
  );
}
