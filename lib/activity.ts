import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityLogRow } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/server";

export interface ActivityLogWithActor extends ActivityLogRow {
  actor: { full_name: string; email: string } | null;
}

export async function listProjectActivity(
  projectId: string,
  limit = 50
): Promise<ActivityLogWithActor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*, actor:profiles(full_name, email)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as unknown as ActivityLogWithActor[];
}

export async function logActivity(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("activity_logs").insert({
    project_id: params.projectId,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });

  // La actividad es informativa: no debe romper la mutación principal si falla.
  if (error) {
    console.error("No se pudo registrar actividad:", error.message);
  }
}
