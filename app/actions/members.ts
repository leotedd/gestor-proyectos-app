"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRole, MANAGER_ROLES } from "@/lib/projects/access";
import { logActivity } from "@/lib/activity";
import type { ProjectRole } from "@/lib/types/database";

export type ActionState = { error?: string; success?: string } | null;

export async function changeMemberRoleAction(
  memberId: string,
  projectId: string,
  role: ProjectRole
): Promise<ActionState> {
  const { userId, supabase } = await requireProjectRole(projectId, MANAGER_ROLES);

  const { data: member } = await supabase
    .from("project_members")
    .select("role, user_id")
    .eq("id", memberId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!member) return { error: "Miembro no encontrado." };
  if (member.role === "OWNER") {
    return { error: "No puedes cambiar el rol del propietario del proyecto." };
  }

  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("id", memberId)
    .eq("project_id", projectId);

  if (error) return { error: error.message };

  await logActivity(supabase, {
    projectId,
    userId,
    action: "member.role_changed",
    entityType: "project_member",
    entityId: memberId,
    metadata: { role },
  });

  revalidatePath(`/projects/${projectId}/members`);
  return { success: "Rol actualizado." };
}

export async function updateMemberAreaAction(
  memberId: string,
  projectId: string,
  areaId: string | null
): Promise<ActionState> {
  const { userId, supabase } = await requireProjectRole(projectId, MANAGER_ROLES);

  const { error } = await supabase
    .from("project_members")
    .update({ area_id: areaId })
    .eq("id", memberId)
    .eq("project_id", projectId);

  if (error) return { error: error.message };

  await logActivity(supabase, {
    projectId,
    userId,
    action: "member.area_changed",
    entityType: "project_member",
    entityId: memberId,
  });

  revalidatePath(`/projects/${projectId}/members`);
  return { success: "Área actualizada." };
}

export async function removeMemberAction(memberId: string, projectId: string) {
  const { userId, supabase } = await requireProjectRole(projectId, MANAGER_ROLES);

  const { data: member } = await supabase
    .from("project_members")
    .select("role")
    .eq("id", memberId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (member?.role === "OWNER") {
    throw new Error("No puedes eliminar al propietario del proyecto.");
  }

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    projectId,
    userId,
    action: "member.removed",
    entityType: "project_member",
    entityId: memberId,
  });

  revalidatePath(`/projects/${projectId}/members`);
}
