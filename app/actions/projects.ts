"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserClient } from "@/lib/auth/dal";
import { requireProjectRole, MANAGER_ROLES } from "@/lib/projects/access";
import { logActivity } from "@/lib/activity";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";

export type ActionState = { error?: string; success?: string } | null;

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Se usa el MISMO cliente para resolver el usuario y para el INSERT: así el
  // `owner_id` que enviamos y el `auth.uid()` que evalúa la política RLS
  // provienen de exactamente la misma sesión verificada.
  const { supabase, user } = await requireUserClient();

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    key: formData.get("key"),
    description: formData.get("description") ?? "",
    startDate: formData.get("startDate") || null,
    endDate: formData.get("endDate") || null,
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { name, key, description, startDate, endDate } = parsed.data;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      key,
      description,
      start_date: startDate,
      end_date: endDate,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un proyecto con el prefijo "${key}".` };
    }
    if (error.code === "42501") {
      return {
        error:
          "No tienes permiso para crear el proyecto (política de seguridad). " +
          "Verifica que ejecutaste la migración SQL más reciente en Supabase y vuelve a intentar; " +
          "si el problema persiste, cierra sesión y vuelve a iniciarla.",
      };
    }
    return { error: error.message };
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    metadata: { name },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}/dashboard`);
}

export async function updateProjectAction(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { userId, supabase } = await requireProjectRole(projectId, MANAGER_ROLES);

  const parsed = updateProjectSchema.safeParse({
    name: formData.get("name") || undefined,
    key: formData.get("key") || undefined,
    description: formData.get("description") ?? undefined,
    startDate: formData.get("startDate") || null,
    endDate: formData.get("endDate") || null,
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { name, key, description, startDate, endDate, status } = parsed.data;

  const { error } = await supabase
    .from("projects")
    .update({
      ...(name !== undefined ? { name } : {}),
      ...(key !== undefined ? { key } : {}),
      ...(description !== undefined ? { description } : {}),
      start_date: startDate,
      end_date: endDate,
      ...(status !== undefined ? { status } : {}),
    })
    .eq("id", projectId);

  if (error) {
    return { error: error.message };
  }

  await logActivity(supabase, {
    projectId,
    userId,
    action: "project.updated",
    entityType: "project",
    entityId: projectId,
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
  return { success: "Proyecto actualizado." };
}

export async function archiveProjectAction(projectId: string): Promise<ActionState> {
  const { userId, supabase } = await requireProjectRole(projectId, ["OWNER"]);

  const { error } = await supabase
    .from("projects")
    .update({ status: "ARCHIVED", archived_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) return { error: error.message };

  await logActivity(supabase, {
    projectId,
    userId,
    action: "project.archived",
    entityType: "project",
    entityId: projectId,
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`, "layout");
  return { success: "Proyecto archivado." };
}

export async function restoreProjectAction(projectId: string): Promise<ActionState> {
  const { userId, supabase } = await requireProjectRole(projectId, ["OWNER"]);

  const { error } = await supabase
    .from("projects")
    .update({ status: "ACTIVE", archived_at: null })
    .eq("id", projectId);

  if (error) return { error: error.message };

  await logActivity(supabase, {
    projectId,
    userId,
    action: "project.restored",
    entityType: "project",
    entityId: projectId,
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`, "layout");
  return { success: "Proyecto restaurado." };
}
