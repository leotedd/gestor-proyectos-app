import { getProjectContext } from "@/lib/projects/access";
import { listProjectTasks } from "@/lib/tasks/queries";
import { listProjectAreas } from "@/lib/areas/queries";
import { listProjectMembers } from "@/lib/members/queries";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskFormModal } from "@/components/tasks/task-form-modal";

export const metadata = { title: "Tablero" };

export default async function BoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ canEdit, canManage, role, userId }, tasks, areas, members] = await Promise.all([
    getProjectContext(projectId),
    listProjectTasks(projectId),
    listProjectAreas(projectId),
    listProjectMembers(projectId),
  ]);

  const memberOptions = members.map((m) => ({
    id: m.profile.id,
    name: m.profile.full_name || m.profile.email,
  }));

  return (
    <div>
      <div className="flex items-center justify-between px-6 pt-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Tablero Kanban</h2>
          <p className="text-sm text-muted-foreground">
            Arrastra las tarjetas para cambiar el estado de una tarea.
          </p>
        </div>
        {canManage && (
          <TaskFormModal
            projectId={projectId}
            areas={areas}
            members={memberOptions}
            role={role}
            currentUserId={userId}
          />
        )}
      </div>

      <KanbanBoard
        projectId={projectId}
        initialTasks={tasks}
        areas={areas}
        members={memberOptions}
        canEdit={canEdit}
        role={role}
        currentUserId={userId}
      />
    </div>
  );
}
