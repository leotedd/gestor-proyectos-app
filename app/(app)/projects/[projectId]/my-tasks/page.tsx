import { getProjectContext } from "@/lib/projects/access";
import { listProjectTasks } from "@/lib/tasks/queries";
import { MyTasksBoard } from "@/components/tasks/my-tasks-board";

export const metadata = { title: "Mis tareas" };

export default async function MyTasksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ userId }, tasks] = await Promise.all([
    getProjectContext(projectId),
    listProjectTasks(projectId),
  ]);
  const myTasks = tasks.filter((t) => t.assignee?.id === userId);

  return (
    <div className="px-6 py-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Mis tareas</h2>
        <p className="text-sm text-muted-foreground">
          {myTasks.length} tarea{myTasks.length !== 1 ? "s" : ""} asignada
          {myTasks.length !== 1 ? "s" : ""} a ti en este proyecto.
        </p>
      </div>

      <MyTasksBoard tasks={myTasks} />
    </div>
  );
}
