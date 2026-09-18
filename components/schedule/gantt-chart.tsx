import { differenceInCalendarDays, eachMonthOfInterval, format, max, min } from "date-fns";
import { es } from "date-fns/locale";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/lib/tasks/types";

const STATUS_BAR: Record<string, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
};

export function GanttChart({ tasks }: { tasks: TaskWithRelations[] }) {
  const dated = tasks.filter((t) => t.start_date || t.due_date);

  if (dated.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Sin fechas registradas"
        description="Asigna fechas de inicio y vencimiento a tus tareas para visualizarlas aquí."
      />
    );
  }

  const starts = dated.map((t) => new Date(t.start_date ?? t.due_date!));
  const ends = dated.map((t) => new Date(t.due_date ?? t.start_date!));
  const rangeStart = min(starts);
  const rangeEnd = max([...ends, rangeStart]);
  const totalDays = Math.max(differenceInCalendarDays(rangeEnd, rangeStart) + 1, 1);

  const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });

  const dayWidth = 100 / totalDays;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(totalDays * 14, 640) }}>
          <div className="flex border-b border-border bg-surface-muted/60 text-xs font-medium text-muted-foreground">
            <div className="w-64 shrink-0 px-3 py-2 border-r border-border">Tarea</div>
            <div className="w-40 shrink-0 px-3 py-2 border-r border-border">Responsable</div>
            <div className="relative flex-1 py-2">
              {months.map((m) => {
                const offset = Math.max(differenceInCalendarDays(m, rangeStart), 0);
                return (
                  <span
                    key={m.toISOString()}
                    className="absolute top-2 text-[11px]"
                    style={{ left: `${offset * dayWidth}%` }}
                  >
                    {format(m, "MMM yyyy", { locale: es })}
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            {dated.map((task) => {
              const start = new Date(task.start_date ?? task.due_date!);
              const end = new Date(task.due_date ?? task.start_date!);
              const offset = Math.max(differenceInCalendarDays(start, rangeStart), 0);
              const duration = Math.max(differenceInCalendarDays(end, start) + 1, 1);

              return (
                <div key={task.id} className="flex border-b border-border last:border-0 text-sm">
                  <div className="w-64 shrink-0 px-3 py-2.5 border-r border-border min-w-0">
                    <p className="font-medium text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{task.code}</p>
                  </div>
                  <div className="w-40 shrink-0 px-3 py-2.5 border-r border-border flex items-center gap-2 min-w-0">
                    {task.assignee ? (
                      <>
                        <Avatar name={task.assignee.full_name || task.assignee.email} size="sm" />
                        <span className="truncate text-xs">
                          {task.assignee.full_name || task.assignee.email}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin asignar</span>
                    )}
                  </div>
                  <div className="relative flex-1 py-2.5 px-1">
                    <div
                      className={cn(
                        "h-5 rounded-md flex items-center px-2 text-[10px] text-white font-medium whitespace-nowrap overflow-hidden",
                        STATUS_BAR[task.status]
                      )}
                      style={{
                        marginLeft: `${offset * dayWidth}%`,
                        width: `${duration * dayWidth}%`,
                        minWidth: 24,
                      }}
                      title={`${task.title} · ${task.progress}%`}
                    >
                      {task.progress}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-surface-muted/40 text-xs text-muted-foreground">
        <LegendDot color="bg-slate-400" label="Por hacer" />
        <LegendDot color="bg-blue-500" label="En progreso" />
        <LegendDot color="bg-amber-500" label="En revisión" />
        <LegendDot color="bg-emerald-500" label="Completado" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}
