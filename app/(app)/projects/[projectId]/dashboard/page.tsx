import {
  ListChecks,
  CircleDashed,
  Loader2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";
import { listProjectTasks } from "@/lib/tasks/queries";
import { listProjectMembers } from "@/lib/members/queries";
import { listProjectAreas } from "@/lib/areas/queries";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  TasksByStatusChart,
  TasksByPriorityChart,
  ProgressByAreaChart,
  TasksByMemberChart,
} from "@/components/dashboard/charts";
import { isOverdue } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [tasks, members, areas] = await Promise.all([
    listProjectTasks(projectId),
    listProjectMembers(projectId),
    listProjectAreas(projectId),
  ]);

  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "TODO").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const review = tasks.filter((t) => t.status === "REVIEW").length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const avgProgress = total
    ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / total)
    : 0;

  const memberOptions = members.map((m) => ({
    id: m.profile.id,
    name: m.profile.full_name || m.profile.email,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total de tareas" value={total} icon={ListChecks} />
        <StatCard label="Pendientes" value={todo} icon={CircleDashed} />
        <StatCard label="En progreso" value={inProgress} icon={Loader2} />
        <StatCard label="En revisión" value={review} icon={Eye} />
        <StatCard label="Completadas" value={done} icon={CheckCircle2} tone="success" />
        <StatCard label="Vencidas" value={overdue} icon={AlertTriangle} tone={overdue > 0 ? "danger" : "default"} />
        <StatCard label="Avance general" value={`${avgProgress}%`} icon={TrendingUp} tone="warning" />
        <StatCard label="Miembros activos" value={members.length} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TasksByStatusChart tasks={tasks} />
        <TasksByPriorityChart tasks={tasks} />
        <ProgressByAreaChart tasks={tasks} areas={areas} />
        <TasksByMemberChart tasks={tasks} members={memberOptions} />
      </div>
    </div>
  );
}
