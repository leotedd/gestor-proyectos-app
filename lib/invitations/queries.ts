import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { InvitationRow } from "@/lib/types/database";

export async function listProjectInvitations(projectId: string): Promise<InvitationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data;
}

export interface InvitationWithProject extends InvitationRow {
  project: { id: string; name: string; key: string };
}

export async function getInvitationByToken(
  token: string
): Promise<InvitationWithProject | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("*, project:projects(id, name, key)")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as InvitationWithProject;
}
