import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AreaRow, ProfileRow, ProjectRole } from "@/lib/types/database";

export interface ProjectMemberWithProfile {
  id: string;
  role: ProjectRole;
  area: AreaRow | null;
  profile: ProfileRow;
  created_at: string;
}

export async function listProjectMembers(
  projectId: string
): Promise<ProjectMemberWithProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select(
      "id, role, created_at, area:areas(*), profile:profiles!project_members_user_id_fkey(*)"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron cargar los miembros del proyecto: ${error.message}`);
  }
  return (data ?? []) as unknown as ProjectMemberWithProfile[];
}
