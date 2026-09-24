import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { InvitationPreview, InvitationRow } from "@/lib/types/database";

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

/**
 * Igual que `getInvitationByToken`, pero funciona SIN sesión activa (usa la
 * función SECURITY DEFINER `get_invitation_preview`, acotada al token exacto
 * que se le pasa — nunca expone la tabla `invitations` completa). Se usa en
 * `/invite/[token]` para mostrar el proyecto/rol antes de que el invitado
 * decida iniciar su sesión temporal.
 */
export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invitation_preview", { p_token: token });

  if (error || !data || data.length === 0) return null;
  return data[0] as InvitationPreview;
}
