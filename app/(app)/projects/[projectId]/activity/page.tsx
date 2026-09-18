import { listProjectActivity } from "@/lib/activity";
import { ActivityFeed } from "@/components/activity/activity-feed";

export const metadata = { title: "Actividad" };

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const logs = await listProjectActivity(projectId);

  return (
    <div className="px-6 py-6 max-w-2xl">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-foreground">Actividad reciente</h2>
        <p className="text-sm text-muted-foreground">
          Historial de acciones relevantes del proyecto.
        </p>
      </div>
      <ActivityFeed logs={logs} />
    </div>
  );
}
