import { listProjectTasks } from "@/lib/tasks/queries";
import { GanttChart } from "@/components/schedule/gantt-chart";

export const metadata = { title: "Cronograma" };

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const tasks = await listProjectTasks(projectId);

  return (
    <div className="px-6 py-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Cronograma</h2>
        <p className="text-sm text-muted-foreground">
          Qué está trabajando cada integrante y durante qué periodo.
        </p>
      </div>
      <GanttChart tasks={tasks} />
    </div>
  );
}
