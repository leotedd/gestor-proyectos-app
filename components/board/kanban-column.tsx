import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/board/task-card";
import type { TaskWithRelations } from "@/lib/tasks/types";
import type { TaskStatus } from "@/lib/types/database";

export function KanbanColumn({
  id,
  title,
  tasks,
  isTaskDisabled,
  accentClass,
  onTaskClick,
}: {
  id: TaskStatus;
  title: string;
  tasks: TaskWithRelations[];
  isTaskDisabled: (task: TaskWithRelations) => boolean;
  accentClass: string;
  onTaskClick: (task: TaskWithRelations) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-surface-muted/60 border border-border">
      <div className="flex items-center gap-2 px-3 py-3">
        <span className={cn("h-2 w-2 rounded-full", accentClass)} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-surface rounded-full px-2 py-0.5 border border-border">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 p-2 min-h-32 overflow-y-auto max-h-[calc(100vh-15rem)] transition-colors rounded-b-xl",
          isOver && "bg-primary/5"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              disabled={isTaskDisabled(task)}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Sin tareas</p>
        )}
      </div>
    </div>
  );
}
