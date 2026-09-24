import { getProjectContext } from "@/lib/projects/access";
import { listProjectAreas } from "@/lib/areas/queries";
import { listProjectTasks } from "@/lib/tasks/queries";
import { AreasList } from "@/components/areas/areas-list";
import { AreaFormModal } from "@/components/areas/area-form-modal";

export const metadata = { title: "Áreas" };

export default async function AreasPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ canManage }, areas, tasks] = await Promise.all([
    getProjectContext(projectId),
    listProjectAreas(projectId),
    listProjectTasks(projectId),
  ]);

  const taskCounts: Record<string, number> = {};
  for (const task of tasks) {
    if (task.area) taskCounts[task.area.id] = (taskCounts[task.area.id] ?? 0) + 1;
  }

  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Áreas</h2>
          <p className="text-sm text-muted-foreground">
            Organiza a tu equipo por área de trabajo.
          </p>
        </div>
        {canManage && <AreaFormModal projectId={projectId} />}
      </div>

      <AreasList projectId={projectId} areas={areas} canManage={canManage} taskCounts={taskCounts} />
    </div>
  );
}
