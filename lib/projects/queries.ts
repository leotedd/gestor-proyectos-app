import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import type { ProjectRole, ProjectRow } from "@/lib/types/database";

export interface UserProjectSummary extends ProjectRow {
  role: ProjectRole;
}

/** Lista los proyectos donde el usuario actual es miembro (RLS ya filtra). */
export async function listUserProjects(): Promise<UserProjectSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_members")
    .select("role, project:projects(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data
    .filter((row) => row.project)
    .map((row) => ({ ...(row.project as unknown as ProjectRow), role: row.role }));
}
