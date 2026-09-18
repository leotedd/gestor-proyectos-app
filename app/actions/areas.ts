"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRole, MANAGER_ROLES } from "@/lib/projects/access";
import { logActivity } from "@/lib/activity";
import { createAreaSchema } from "@/lib/validations";

export type ActionState = { error?: string; success?: string } | null;

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

export async function createAreaAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const parsed = createAreaSchema.safeParse({
    projectId,
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { userId, supabase } = await requireProjectRole(parsed.data.projectId, MANAGER_ROLES);

  const { data, error } = await supabase
    .from("areas")
    .insert({
      project_id: parsed.data.projectId,
      name: parsed.data.name,
      description: parsed.data.description,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un área con ese nombre." };
    return { error: error.message };
  }

  await logActivity(supabase, {
    projectId: parsed.data.projectId,
    userId,
    action: "area.created",
    entityType: "area",
    entityId: data.id,
    metadata: { name: parsed.data.name },
  });

  revalidatePath(`/projects/${parsed.data.projectId}/areas`);
  return { success: "Área creada." };
}

export async function updateAreaAction(
  areaId: string,
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createAreaSchema
    .omit({ projectId: true })
    .safeParse({ name: formData.get("name"), description: formData.get("description") ?? "" });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { userId, supabase } = await requireProjectRole(projectId, MANAGER_ROLES);

  const { error } = await supabase
    .from("areas")
    .update({ name: parsed.data.name, description: parsed.data.description })
    .eq("id", areaId)
    .eq("project_id", projectId);

  if (error) return { error: error.message };

  await logActivity(supabase, {
    projectId,
    userId,
    action: "area.updated",
    entityType: "area",
    entityId: areaId,
  });

  revalidatePath(`/projects/${projectId}/areas`);
  return { success: "Área actualizada." };
}

export async function deleteAreaAction(areaId: string, projectId: string) {
  const { userId, supabase } = await requireProjectRole(projectId, MANAGER_ROLES);

  const { error } = await supabase
    .from("areas")
    .delete()
    .eq("id", areaId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    projectId,
    userId,
    action: "area.deleted",
    entityType: "area",
    entityId: areaId,
  });

  revalidatePath(`/projects/${projectId}/areas`);
}
