import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { ProjectRole, TaskPriority, TaskStatus } from "@/lib/types/database";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  primary: "bg-indigo-100 text-indigo-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

const statusLabels: Record<TaskStatus, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  REVIEW: "En revisión",
  DONE: "Completado",
};
const statusTones: Record<TaskStatus, Tone> = {
  TODO: "neutral",
  IN_PROGRESS: "info",
  REVIEW: "warning",
  DONE: "success",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>;
}

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};
const priorityTones: Record<TaskPriority, Tone> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "danger",
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={priorityTones[priority]}>{priorityLabels[priority]}</Badge>;
}

const roleLabels: Record<ProjectRole, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MEMBER: "Miembro",
  VIEWER: "Observador",
};
const roleTones: Record<ProjectRole, Tone> = {
  OWNER: "primary",
  ADMIN: "info",
  MEMBER: "neutral",
  VIEWER: "warning",
};

export function RoleBadge({ role }: { role: ProjectRole }) {
  return <Badge tone={roleTones[role]}>{roleLabels[role]}</Badge>;
}

export { statusLabels, priorityLabels, roleLabels };
