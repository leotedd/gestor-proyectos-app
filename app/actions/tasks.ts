"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRole, EDITOR_ROLES, MANAGER_ROLES } from "@/lib/projects/access";
import { logActivity } from "@/lib/activity";
import { createTaskSchema, updateTaskSchema } from "@/lib/validations";

export type ActionState = { error?: string; success?: string } | null;

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}/members`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const parsed = createTaskSchema.safeParse({
    projectId,
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    areaId: formData.get("areaId") || null,
    assigneeId: formData.get("assigneeId") || null,
    priority: formData.get("priority") || "MEDIUM",
    status: formData.get("status") || "TODO",
    startDate: formData.get("startDate") || null,
    dueDate: formData.get("dueDate") || null,
    progress: formData.get("progress") || 0,
    labels: String(formData.get("labels") ?? "")
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { userId, supabase } = await requireProjectRole(parsed.data.projectId, EDITOR_ROLES);

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      area_id: parsed.data.areaId,
      priority: parsed.data.priority,
      status: parsed.data.status,
      start_date: parsed.data.startDate,
      due_date: parsed.data.dueDate,
      progress: parsed.data.progress,
      labels: parsed.data.labels,
      created_by: userId,
    })
    .select("id, code")
    .single();

  if (error || !task) {
    return { error: error?.message ?? "No se pudo crear la tarea." };
  }

  if (parsed.data.assigneeId) {
    await supabase.from("task_assignments").insert({
      task_id: task.id,
      user_id: parsed.data.assigneeId,
      assigned_by: userId,
    });
  }

  await logActivity(supabase, {
    projectId: parsed.data.projectId,
    userId,
    action: "task.created",
    entityType: "task",
    entityId: task.id,
    metadata: { code: task.code, title: parsed.data.title },
  });

  revalidateProject(parsed.data.projectId);
  return { success: `Tarea ${task.code} creada.` };
}

export async function updateTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");

  const parsed = updateTaskSchema.safeParse({
    taskId,
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    areaId: formData.get("areaId") || null,
    assigneeId: formData.get("assigneeId") || null,
    priority: formData.get("priority") || "MEDIUM",
    status: formData.get("status") || "TODO",
    startDate: formData.get("startDate") || null,
    dueDate: formData.get("dueDate") || null,
    progress: formData.get("progress") || 0,
    labels: String(formData.get("labels") ?? "")
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { userId, supabase } = await requireProjectRole(projectId, EDITOR_ROLES);

  const { taskId: id, assigneeId, ...rest } = parsed.data;

  const { error } = await supabase
    .from("tasks")
    .update({
      title: rest.title,
      description: rest.description,
      area_id: rest.areaId,
      priority: rest.priority,
      status: rest.status,
      start_date: rest.startDate,
      due_date: rest.dueDate,
      progress: rest.progress,
      labels: rest.labels,
    })
    .eq("id", id)
    .eq("project_id", projectId);

  if (error) {
    return { error: error.message };
  }

  await supabase.from("task_assignments").delete().eq("task_id", id);
  if (assigneeId) {
    await supabase.from("task_assignments").insert({
      task_id: id,
      user_id: assigneeId,
      assigned_by: userId,
    });
  }

  await logActivity(supabase, {
    projectId,
    userId,
    action: "task.updated",
    entityType: "task",
    entityId: id,
  });

  revalidateProject(projectId);
  return { success: "Tarea actualizada." };
}

/** Usado por el Kanban (drag & drop). No usa useActionState: se llama directo. */
export async function moveTaskAction(params: {
  taskId: string;
  projectId: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  position: number;
}) {
  const { userId, supabase } = await requireProjectRole(params.projectId, EDITOR_ROLES);

  const update: Record<string, unknown> = {
    status: params.status,
    position: params.position,
  };
  if (params.status === "DONE") update.progress = 100;

  const { error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", params.taskId)
    .eq("project_id", params.projectId);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    projectId: params.projectId,
    userId,
    action: "task.status_changed",
    entityType: "task",
    entityId: params.taskId,
    metadata: { status: params.status },
  });

  revalidateProject(params.projectId);
}

export async function deleteTaskAction(taskId: string, projectId: string) {
  const { userId, supabase } = await requireProjectRole(projectId, MANAGER_ROLES);

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    projectId,
    userId,
    action: "task.deleted",
    entityType: "task",
    entityId: taskId,
  });

  revalidateProject(projectId);
}
