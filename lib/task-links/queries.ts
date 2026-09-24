import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskLink } from "./validations";

export async function requireTaskInProject(supabase: SupabaseClient, projectId: string, taskId: string) {
  const { data, error } = await supabase.from("tasks").select("id, code")
    .eq("id", taskId).eq("project_id", projectId).maybeSingle();
  if (error || !data) throw new Error("La tarea no existe o no tienes acceso a ella.");
  return data as { id: string; code: string };
}

/** El cliente autenticado y la comprobación de tarea mantienen el mismo contexto RLS. */
export async function listTaskLinks(supabase: SupabaseClient, projectId: string, taskId: string): Promise<TaskLink[]> {
  await requireTaskInProject(supabase, projectId, taskId);
  const { data, error } = await supabase.from("task_links")
    .select("id, task_id, title, url, created_by, created_at, updated_at")
    .eq("task_id", taskId).order("created_at").order("id");
  if (error) throw new Error("No se pudieron cargar los enlaces. Intenta nuevamente.");
  return (data ?? []) as TaskLink[];
}
