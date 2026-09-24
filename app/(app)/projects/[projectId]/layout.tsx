import { Eye } from "lucide-react";
import { getProjectContext } from "@/lib/projects/access";
import { RoleBadge, Badge } from "@/components/ui/badge";
import { SyncProjectRole } from "@/components/layout/sync-project-role";

const statusLabel: Record<string, string> = {
  ACTIVE: "Activo",
  ON_HOLD: "En pausa",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
};

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role, isViewer } = await getProjectContext(projectId);

  return (
    <div className="flex flex-col min-h-full">
      <SyncProjectRole projectId={projectId} role={role} />
      <div className="border-b border-border bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono font-semibold text-primary">{project.key}</p>
            <h1 className="text-lg font-semibold text-foreground">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <RoleBadge role={role} />
            <Badge tone={project.status === "ARCHIVED" ? "danger" : "success"}>
              {statusLabel[project.status]}
            </Badge>
          </div>
        </div>
      </div>

      {isViewer && (
        <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-800">
          <Eye className="h-4 w-4 shrink-0" />
          Estás en modo observador (solo lectura). No puedes crear, editar ni mover
          elementos en este proyecto.
        </div>
      )}

      <div className="flex-1">{children}</div>
    </div>
  );
}
