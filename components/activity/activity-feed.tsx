import {
  FolderPlus,
  ListPlus,
  RefreshCw,
  UserPlus,
  UserMinus,
  Mail,
  FileUp,
  FileMinus,
  FolderCog,
  Archive,
  Trash2,
  Link2,
  Activity as ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/utils";
import type { ActivityLogWithActor } from "@/lib/activity";

const ACTION_META: Record<string, { icon: LucideIcon; label: string }> = {
  "project.created": { icon: FolderPlus, label: "creó el proyecto" },
  "project.updated": { icon: FolderCog, label: "actualizó el proyecto" },
  "project.archived": { icon: Archive, label: "archivó el proyecto" },
  "project.restored": { icon: RefreshCw, label: "restauró el proyecto" },
  "project.demo_seeded": { icon: FolderPlus, label: "generó datos de demostración" },
  "task.created": { icon: ListPlus, label: "creó la tarea" },
  "task.updated": { icon: FolderCog, label: "actualizó la tarea" },
  "task.status_changed": { icon: RefreshCw, label: "cambió el estado de la tarea" },
  "task.deleted": { icon: Trash2, label: "eliminó una tarea" },
  "area.created": { icon: FolderPlus, label: "creó el área" },
  "area.updated": { icon: FolderCog, label: "actualizó el área" },
  "area.deleted": { icon: Trash2, label: "eliminó un área" },
  "member.role_changed": { icon: RefreshCw, label: "cambió el rol de un miembro" },
  "member.area_changed": { icon: FolderCog, label: "cambió el área de un miembro" },
  "member.removed": { icon: UserMinus, label: "quitó a un miembro" },
  "invitation.sent": { icon: Mail, label: "envió una invitación" },
  "invitation.cancelled": { icon: Mail, label: "canceló una invitación" },
  "invitation.accepted": { icon: UserPlus, label: "se unió al proyecto" },
  "attachment.added": { icon: FileUp, label: "agregó un documento" },
  "attachment.deleted": { icon: FileMinus, label: "eliminó un documento" },
  "task_link.created": { icon: Link2, label: "agregó un enlace a una tarea" },
  "task_link.updated": { icon: Link2, label: "editó un enlace de una tarea" },
  "task_link.deleted": { icon: Link2, label: "eliminó un enlace de una tarea" },
};

export function ActivityFeed({ logs }: { logs: ActivityLogWithActor[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="Sin actividad todavía"
        description="Las acciones del equipo aparecerán aquí en tiempo real."
      />
    );
  }

  return (
    <div className="relative space-y-0">
      {logs.map((log, idx) => {
        const meta = ACTION_META[log.action] ?? { icon: ActivityIcon, label: log.action };
        const Icon = meta.icon;
        const actorName = log.actor?.full_name || log.actor?.email || "Alguien";
        const detail =
          typeof log.metadata?.title === "string"
            ? log.metadata.title
            : typeof log.metadata?.name === "string"
              ? log.metadata.name
              : typeof log.metadata?.email === "string"
                ? log.metadata.email
                : null;

        return (
          <div key={log.id} className="flex gap-3 pb-5 relative">
            {idx < logs.length - 1 && (
              <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
            )}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface border border-border z-10">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">{actorName}</span> {meta.label}
                {detail && <span className="text-muted-foreground"> · {detail}</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Avatar name={actorName} size="sm" className="h-4 w-4 text-[8px]" />
                {formatDateTime(log.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
