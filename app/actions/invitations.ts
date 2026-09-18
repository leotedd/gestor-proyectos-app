"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserClient } from "@/lib/auth/dal";
import { requireProjectRole, MANAGER_ROLES } from "@/lib/projects/access";
import { logActivity } from "@/lib/activity";
import { inviteMemberSchema } from "@/lib/validations";
import { sendInvitationEmail } from "@/lib/email/resend";

export type ActionState = { error?: string; success?: string } | null;

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

export async function createInvitationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const parsed = inviteMemberSchema.safeParse({
    projectId,
    email: formData.get("email"),
    role: formData.get("role") || "MEMBER",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { userId, supabase } = await requireProjectRole(parsed.data.projectId, MANAGER_ROLES);

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", parsed.data.projectId)
    .single();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", parsed.data.email)
    .maybeSingle();

  if (existingProfile) {
    const { data: existingMember } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", parsed.data.projectId)
      .eq("user_id", existingProfile.id)
      .maybeSingle();

    if (existingMember) {
      return { error: "Esa persona ya es miembro del proyecto." };
    }
  }

  const { data: inviter } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      project_id: parsed.data.projectId,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: userId,
    })
    .select("id, token")
    .single();

  if (error || !invitation) {
    return { error: error?.message ?? "No se pudo crear la invitación." };
  }

  await logActivity(supabase, {
    projectId: parsed.data.projectId,
    userId,
    action: "invitation.sent",
    entityType: "invitation",
    entityId: invitation.id,
    metadata: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath(`/projects/${parsed.data.projectId}/settings`);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const result = await sendInvitationEmail({
    to: parsed.data.email,
    projectName: project?.name ?? "el proyecto",
    role: parsed.data.role,
    inviterName: inviter?.full_name || "Un administrador",
    acceptUrl: `${siteUrl}/invite/${invitation.token}`,
  });

  if (!result.sent) {
    return {
      success: `Invitación creada para ${parsed.data.email}. ${result.reason ?? ""}`,
    };
  }

  return { success: `Invitación enviada a ${parsed.data.email}.` };
}

export async function cancelInvitationAction(invitationId: string, projectId: string) {
  const { userId, supabase } = await requireProjectRole(projectId, MANAGER_ROLES);

  const { error } = await supabase
    .from("invitations")
    .update({ status: "CANCELLED" })
    .eq("id", invitationId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    projectId,
    userId,
    action: "invitation.cancelled",
    entityType: "invitation",
    entityId: invitationId,
  });

  revalidatePath(`/projects/${projectId}/settings`);
}

export async function acceptInvitationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const { supabase, user } = await requireUserClient();

  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) return { error: "Invitación no encontrada." };
  if (invitation.status !== "PENDING") {
    return { error: "Esta invitación ya no está disponible." };
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await supabase.from("invitations").update({ status: "EXPIRED" }).eq("id", invitation.id);
    return { error: "Esta invitación ha expirado." };
  }
  if (invitation.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return {
      error: `Esta invitación es para ${invitation.email}. Inicia sesión con ese correo.`,
    };
  }

  const { error: memberError } = await supabase.from("project_members").upsert(
    {
      project_id: invitation.project_id,
      user_id: user.id,
      role: invitation.role,
      invited_by: invitation.invited_by,
    },
    { onConflict: "project_id,user_id", ignoreDuplicates: true }
  );

  if (memberError) {
    if (memberError.code === "42501") {
      return {
        error:
          "No se pudo unirte al proyecto por una política de seguridad desactualizada. " +
          "Pide a un administrador que ejecute la migración SQL más reciente en Supabase.",
      };
    }
    return { error: memberError.message };
  }

  await supabase.from("invitations").update({ status: "ACCEPTED" }).eq("id", invitation.id);

  await logActivity(supabase, {
    projectId: invitation.project_id,
    userId: user.id,
    action: "invitation.accepted",
    entityType: "invitation",
    entityId: invitation.id,
  });

  revalidatePath("/projects");
  redirect(`/projects/${invitation.project_id}/dashboard`);
}
