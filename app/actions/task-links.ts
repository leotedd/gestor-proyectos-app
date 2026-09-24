"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireProjectRole, EDITOR_ROLES, MANAGER_ROLES } from "@/lib/projects/access";
import { logActivity } from "@/lib/activity";
import { listTaskLinks, requireTaskInProject } from "@/lib/task-links/queries";
import { createTaskLinkSchema, updateTaskLinkSchema, deleteTaskLinkSchema, taskLinkScopeSchema, type TaskLink } from "@/lib/task-links/validations";

type Result<T> = { data: T; error?: never } | { error: string; data?: never };

function actionError(error: unknown): { error: string } {
  unstable_rethrow(error);
  return { error: error instanceof Error ? error.message : "No se pudo completar la operación." };
}

export async function listTaskLinksAction(input: unknown): Promise<Result<{ links: TaskLink[]; canEdit: boolean; canDelete: boolean }>> {
  const parsed = taskLinkScopeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { projectId, taskId } = parsed.data;
    const { supabase, role } = await requireProjectRole(projectId, [...EDITOR_ROLES, "VIEWER"]);
    return { data: { links: await listTaskLinks(supabase, projectId, taskId), canEdit: EDITOR_ROLES.includes(role), canDelete: MANAGER_ROLES.includes(role) } };
  } catch (error) { return actionError(error); }
}

async function mutateTaskLink(operation: "created" | "updated" | "deleted", input: unknown): Promise<Result<TaskLink>> {
  const schema = operation === "created" ? createTaskLinkSchema : operation === "updated" ? updateTaskLinkSchema : deleteTaskLinkSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const values = parsed.data;
    const { projectId, taskId } = values;
    const { supabase, userId } = await requireProjectRole(projectId, operation === "deleted" ? MANAGER_ROLES : EDITOR_ROLES);
    const task = await requireTaskInProject(supabase, projectId, taskId);
    const table = supabase.from("task_links");
    const query = operation === "created" && "title" in values
      ? table.insert({ task_id: taskId, title: values.title, url: values.url, created_by: userId })
      : operation === "updated" && "title" in values && "linkId" in values
        ? table.update({ title: values.title, url: values.url }).eq("id", values.linkId).eq("task_id", taskId)
        : "linkId" in values ? table.delete().eq("id", values.linkId).eq("task_id", taskId) : null;
    if (!query) return { error: "Datos inválidos." };
    const { data, error } = await query.select("id, task_id, title, url, created_by, created_at, updated_at").maybeSingle();
    if (error || !data) return { error: "No se pudo guardar el cambio. Verifica tus permisos y que el enlace todavía exista." };
    const link = data as TaskLink;
    await logActivity(supabase, {
      projectId, userId, action: `task_link.${operation}`, entityType: "task_link", entityId: link.id,
      metadata: { task_id: taskId, code: task.code, title: link.title },
    });
    revalidatePath(`/projects/${projectId}/tasks`);
    revalidatePath(`/projects/${projectId}/board`);
    revalidatePath(`/projects/${projectId}/activity`);
    return { data: link };
  } catch (error) { return actionError(error); }
}

export async function createTaskLinkAction(input: unknown) { return mutateTaskLink("created", input); }
export async function updateTaskLinkAction(input: unknown) { return mutateTaskLink("updated", input); }
export async function deleteTaskLinkAction(input: unknown) { return mutateTaskLink("deleted", input); }
