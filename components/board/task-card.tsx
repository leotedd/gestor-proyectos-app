import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TaskPriorityBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { TaskWithRelations } from "@/lib/tasks/types";

export function TaskCard({
  task,
  disabled,
  onClick,
}: {
  task: TaskWithRelations;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue = isOverdue(task.due_date, task.status);

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>
      <Card
        onClick={onClick}
        className={cn(
          "p-3 space-y-2 hover:border-primary/40 transition-colors",
          onClick && "cursor-pointer"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-mono font-semibold text-muted-foreground">
            {task.code}
          </span>
          {!disabled && (
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing -mt-1 -mr-1 p-1"
              aria-label="Mover tarea"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {task.title}
        </p>

        {task.area && (
          <span className="inline-block text-[11px] text-muted-foreground bg-surface-muted rounded px-1.5 py-0.5">
            {task.area.name}
          </span>
        )}

        <div className="flex items-center justify-between pt-1">
          <TaskPriorityBadge priority={task.priority} />
          {task.assignee && (
            <Avatar name={task.assignee.full_name || task.assignee.email} size="sm" />
          )}
        </div>

        {task.due_date && (
          <div
            className={cn(
              "flex items-center gap-1 text-[11px]",
              overdue ? "text-danger font-medium" : "text-muted-foreground"
            )}
          >
            <CalendarClock className="h-3 w-3" />
            {formatDate(task.due_date)}
          </div>
        )}

        {task.progress > 0 && (
          <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
