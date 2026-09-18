import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TaskWithRelations } from "@/lib/tasks/types";

const TASK_SELECT = `
  *,
  area:areas ( id, name ),
  task_assignments (
    user_id,
    profile:profiles!task_assignments_user_id_fkey ( id, full_name, email, avatar_url )
  )
`;

type RawTask = {
  task_assignments?: { user_id: string; profile: unknown }[];
  [key: string]: unknown;
};

function normalize(row: RawTask): TaskWithRelations {
  const { task_assignments, ...rest } = row;
  const assignee = task_assignments?.[0]?.profile ?? null;
  return {
    ...(rest as unknown as TaskWithRelations),
    assignee: assignee as TaskWithRelations["assignee"],
  };
}

export async function listProjectTasks(projectId: string): Promise<TaskWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron cargar las tareas del proyecto: ${error.message}`);
  }
  return (data as unknown as RawTask[] | null ?? []).map(normalize);
}

export async function getTask(taskId: string): Promise<TaskWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar la tarea: ${error.message}`);
  }
  if (!data) return null;
  return normalize(data as unknown as RawTask);
}
