import { getProjectContext } from "@/lib/projects/access";
import { listProjectMembers } from "@/lib/members/queries";
import { listProjectTasks } from "@/lib/tasks/queries";
import { listProjectAreas } from "@/lib/areas/queries";
import { listProjectInvitations } from "@/lib/invitations/queries";
import { MembersTable, type MemberStat } from "@/components/members/members-table";
import { InviteMemberModal } from "@/components/members/invite-member-modal";
import { PendingInvitations } from "@/components/members/pending-invitations";

export const metadata = { title: "Miembros" };

export default async function MembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { canManage } = await getProjectContext(projectId);

  const [members, tasks, areas, invitations] = await Promise.all([
    listProjectMembers(projectId),
    listProjectTasks(projectId),
    listProjectAreas(projectId),
    canManage ? listProjectInvitations(projectId) : Promise.resolve([]),
  ]);

  const stats: MemberStat[] = members.map((m) => {
    const assignedTasks = tasks.filter((t) => t.assignee?.id === m.profile.id);
    const completed = assignedTasks.filter((t) => t.status === "DONE").length;
    const assigned = assignedTasks.length;
    return {
      id: m.id,
      userId: m.profile.id,
      name: m.profile.full_name || m.profile.email,
      email: m.profile.email,
      role: m.role,
      areaId: m.area?.id ?? null,
      assigned,
      completed,
      pending: assigned - completed,
      completionPct: assigned ? Math.round((completed / assigned) * 100) : 0,
    };
  });

  return (
    <div className="px-6 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Miembros y aportes</h2>
          <p className="text-sm text-muted-foreground">
            Rol, área y contribución de cada integrante del proyecto.
          </p>
        </div>
        {canManage && <InviteMemberModal projectId={projectId} />}
      </div>

      <MembersTable projectId={projectId} members={stats} areas={areas} canManage={canManage} />

      {canManage && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Invitaciones</h3>
          <PendingInvitations projectId={projectId} invitations={invitations} />
        </div>
      )}
    </div>
  );
}
