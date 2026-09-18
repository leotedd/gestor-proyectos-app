import { notFound } from "next/navigation";
import { getProjectContext } from "@/lib/projects/access";
import { ProjectSettingsForm } from "@/components/settings/project-settings-form";
import { ArchiveProjectButton } from "@/components/settings/archive-project-button";

export const metadata = { title: "Configuración" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, canManage, role } = await getProjectContext(projectId);

  if (!canManage) {
    notFound();
  }

  return (
    <div className="px-6 py-6 space-y-10">
      <div>
        <h2 className="text-base font-semibold text-foreground">Configuración del proyecto</h2>
        <p className="text-sm text-muted-foreground">
          Datos generales, estado y ciclo de vida del proyecto.
        </p>
      </div>

      <ProjectSettingsForm project={project} />

      {role === "OWNER" && (
        <div className="max-w-xl border-t border-border pt-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">Zona de riesgo</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Archivar el proyecto lo oculta del listado activo. Puedes restaurarlo cuando quieras.
          </p>
          <ArchiveProjectButton projectId={projectId} archived={project.status === "ARCHIVED"} />
        </div>
      )}
    </div>
  );
}
