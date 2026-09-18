import { Suspense } from "react";
import { FolderGit2, Sparkles } from "lucide-react";
import { listUserProjects } from "@/lib/projects/queries";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { seedDemoProjectAction } from "@/app/actions/demo";

export const metadata = { title: "Mis proyectos — Flowbase" };

export default async function ProjectsPage() {
  const projects = await listUserProjects();
  const active = projects.filter((p) => p.status !== "ARCHIVED");
  const archived = projects.filter((p) => p.status === "ARCHIVED");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Mis proyectos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Todos los proyectos donde participas, con tu rol en cada uno.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={seedDemoProjectAction}>
            <SubmitButton variant="outline">
              <Sparkles className="h-4 w-4" /> Crear proyecto de demostración
            </SubmitButton>
          </form>
          <Suspense>
            <CreateProjectModal />
          </Suspense>
        </div>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="Todavía no tienes proyectos"
          description="Crea tu primer proyecto o genera uno de demostración para explorar la plataforma."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          {archived.length > 0 && (
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Archivados
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                {archived.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
