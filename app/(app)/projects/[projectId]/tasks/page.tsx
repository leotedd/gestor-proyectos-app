import { getProjectContext } from "@/lib/projects/access";
import { listProjectTasks } from "@/lib/tasks/queries";
import { listProjectAreas } from "@/lib/areas/queries";
import { listProjectMembers } from "@/lib/members/queries";
import { TasksTable } from "@/components/tasks/tasks-table";
import { TaskFormModal } from "@/components/tasks/task-form-modal";

export const metadata = { title: "Tareas" };

export default async function TasksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { canEdit, canManage } = await getProjectContext(projectId);

  const [tasks, areas, members] = await Promise.all([
    listProjectTasks(projectId),
    listProjectAreas(projectId),
    listProjectMembers(projectId),
  ]);

  const memberOptions = members.map((m) => ({
    id: m.profile.id,
    name: m.profile.full_name || m.profile.email,
  }));

  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Tareas</h2>
          <p className="text-sm text-muted-foreground">
            {tasks.length} tarea{tasks.length !== 1 ? "s" : ""} en este proyecto.
          </p>
        </div>
        {canEdit && (
          <TaskFormModal projectId={projectId} areas={areas} members={memberOptions} />
        )}
      </div>

      <TasksTable
        projectId={projectId}
        tasks={tasks}
        areas={areas}
        members={memberOptions}
        canEdit={canEdit}
        canManage={canManage}
      />
    </div>
  );
}
