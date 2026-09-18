import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AreaRow } from "@/lib/types/database";

export async function listProjectAreas(projectId: string): Promise<AreaRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("areas")
    .select("*")
    .eq("project_id", projectId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron cargar las áreas del proyecto: ${error.message}`);
  }
  return data ?? [];
}
