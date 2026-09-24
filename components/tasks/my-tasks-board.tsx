import { ListTodo, Loader, Eye, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskPriorityBadge } from "@/components/ui/badge";
import { formatDate, isOverdue, cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/lib/tasks/types";
import type { TaskStatus } from "@/lib/types/database";

const columns: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "Pendientes" },
  { status: "IN_PROGRESS", label: "En progreso" },
  { status: "REVIEW", label: "En revisión" },
  { status: "DONE", label: "Completadas" },
];

export function MyTasksBoard({ tasks }: { tasks: TaskWithRelations[] }) {
  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No tienes tareas asignadas en este proyecto"
        description="Cuando alguien te asigne una tarea como responsable, aparecerá aquí."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pendientes" value={byStatus("TODO").length} icon={ListTodo} />
        <StatCard label="En progreso" value={byStatus("IN_PROGRESS").length} icon={Loader} tone="warning" />
        <StatCard label="En revisión" value={byStatus("REVIEW").length} icon={Eye} tone="default" />
        <StatCard label="Completadas" value={byStatus("DONE").length} icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const items = byStatus(col.status);
          return (
            <div key={col.status} className="rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="text-sm font-medium text-foreground">{col.label}</p>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="divide-y divide-border">
                {items.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">Sin tareas.</p>
                ) : (
                  items.map((task) => {
                    const overdue = isOverdue(task.due_date, task.status);
                    return (
                      <div key={task.id} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-muted-foreground">{task.code}</span>
                          <TaskPriorityBadge priority={task.priority} />
                        </div>
                        <p className="text-sm font-medium text-foreground leading-snug">{task.title}</p>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground truncate">
                            {task.area?.name ?? "Sin área"}
                          </span>
                          <span
                            className={cn(
                              "shrink-0",
                              overdue ? "text-danger font-medium" : "text-muted-foreground"
                            )}
                          >
                            {task.due_date ? formatDate(task.due_date) : "Sin fecha"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
