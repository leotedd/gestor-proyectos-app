import Link from "next/link";
import { CalendarRange, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { UserProjectSummary } from "@/lib/projects/queries";

const statusTone: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  ACTIVE: "success",
  ON_HOLD: "warning",
  COMPLETED: "neutral",
  ARCHIVED: "danger",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Activo",
  ON_HOLD: "En pausa",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
};

export function ProjectCard({ project }: { project: UserProjectSummary }) {
  return (
    <Link href={`/projects/${project.id}/dashboard`}>
      <Card className="p-5 h-full flex flex-col gap-3 hover:shadow-md hover:border-primary/40 transition-all group">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-mono font-semibold text-primary">{project.key}</p>
            <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            {formatDate(project.end_date) !== "—"
              ? `Hasta ${formatDate(project.end_date)}`
              : "Sin fecha límite"}
          </div>
          <div className="flex items-center gap-1.5">
            <RoleBadge role={project.role} />
            <Badge tone={statusTone[project.status]}>{statusLabel[project.status]}</Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
