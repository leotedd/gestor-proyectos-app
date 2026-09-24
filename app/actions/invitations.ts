"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserClient } from "@/lib/auth/dal";
import { requireProjectRole, MANAGER_ROLES } from "@/lib/projects/access";
import { logActivity } from "@/lib/activity";
import { inviteMemberSchema, acceptGuestInvitationSchema } from "@/lib/validations";
import { sendInvitationEmail } from "@/lib/email/resend";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string; link?: string } | null;
export type GuestActionState = { error?: string } | null;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

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
  revalidatePath(`/projects/${parsed.data.projectId}/members`);

  const acceptUrl = `${siteUrl()}/invite/${invitation.token}`;
  const result = await sendInvitationEmail({
    to: parsed.data.email,
    projectName: project?.name ?? "el proyecto",
    role: parsed.data.role,
    inviterName: inviter?.full_name || "Un administrador",
    acceptUrl,
  });

  if (!result.sent) {
    return {
      success: `Invitación creada para ${parsed.data.email}. ${result.reason ?? ""}`,
      link: acceptUrl,
    };
  }

  return { success: `Invitación enviada a ${parsed.data.email}.`, link: acceptUrl };
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
  const parsedToken = acceptGuestInvitationSchema.shape.token.safeParse(formData.get("token"));
  if (!parsedToken.success) return { error: "Invitación no encontrada." };

  const { supabase } = await requireUserClient();

  // La validación real (token, estado, expiración, correo de la cuenta,
  // membresía y marcado ACCEPTED) ocurre atómicamente en PostgreSQL.
  // Para una cuenta real, el RPC no modifica su profile.
  const { data: projectId, error } = await supabase.rpc("accept_invitation_by_token", {
    p_token: parsedToken.data,
    p_full_name: "",
    p_username: null,
  });

  if (error || !projectId) {
    return { error: error?.message ?? "No se pudo aceptar la invitación." };
  }

  revalidatePath("/projects");
  redirect(`/projects/${projectId}/dashboard`);
}

/**
 * Acepta una invitación SIN contraseña. Si ya existe una sesión anónima
 * activa (el invitado ya había aceptado otra invitación antes), la
 * reutiliza para sumar esta segunda membresía. Si no hay ninguna sesión,
 * crea una sesión anónima real de Supabase Auth (así RLS sigue protegiendo
 * todo sin excepciones). Si hay una sesión de una cuenta REAL (con
 * contraseña), se rechaza: esa persona debe cerrar sesión primero — la
 * página `/invite/[token]` ya filtra este caso antes de mostrar el form.
 */
export async function acceptInvitationAsGuestAction(
  _prev: GuestActionState,
  formData: FormData
): Promise<GuestActionState> {
  const parsed = acceptGuestInvitationSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    username: formData.get("username") ?? "",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();

  const { data: preview, error: previewError } = await supabase.rpc("get_invitation_preview", {
    p_token: parsed.data.token,
  });

  if (previewError || !preview || preview.length === 0) {
    return { error: "Invitación no encontrada." };
  }
  const invitation = preview[0];

  if (invitation.status !== "PENDING") {
    return { error: "Esta invitación ya no está disponible." };
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return { error: "Esta invitación ha expirado." };
  }
  if (invitation.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return { error: `Esta invitación es para ${invitation.email}.` };
  }

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  if (existingUser && !existingUser.is_anonymous) {
    return {
      error: "Ya tienes una sesión iniciada con una cuenta. Cierra sesión primero.",
    };
  }

  if (!existingUser) {
    const { data, error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError || !data.user) {
      return {
        error:
          anonError?.message ??
          "No se pudo crear tu sesión temporal. Verifica que el proveedor 'Anonymous' esté habilitado en Supabase.",
      };
    }
  }

  const { data: projectId, error: acceptError } = await supabase.rpc(
    "accept_invitation_by_token",
    {
      p_token: parsed.data.token,
      p_full_name: parsed.data.fullName,
      p_username: parsed.data.username ?? null,
    }
  );

  if (acceptError || !projectId) {
    return { error: acceptError?.message ?? "No se pudo aceptar la invitación." };
  }

  revalidatePath("/projects");
  redirect(`/projects/${projectId}/dashboard`);
}
