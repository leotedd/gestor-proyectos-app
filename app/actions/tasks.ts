"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRole, EDITOR_ROLES, MANAGER_ROLES } from "@/lib/projects/access";
import { logActivity } from "@/lib/activity";
import { createTaskSchema, updateTaskSchema, updateTaskAsMemberSchema } from "@/lib/validations";

export type ActionState = { error?: string; success?: string } | null;

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

/** Al completar una tarea, el progreso siempre queda en 100%. */
function resolveProgress(status: string, progress: number): number {
  return status === "DONE" ? 100 : progress;
}

/** El responsable debe ser miembro del proyecto y el área debe pertenecerle. */
async function validateTaskRefs(
  supabase: Awaited<ReturnType<typeof requireProjectRole>>["supabase"],
  projectId: string,
  areaId: string | null | undefined,
  assigneeId: string | null | undefined
): Promise<string | null> {
  if (assigneeId) {
    const { data } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", assigneeId)
      .maybeSingle();
    if (!data) return "El responsable seleccionado no es miembro de este proyecto.";
  }
  if (areaId) {
    const { data } = await supabase
      .from("areas")
      .select("id")
      .eq("id", areaId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!data) return "El área seleccionada no pertenece a este proyecto.";
  }
  return null;
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

  // Solo PROPIETARIO puede crear tareas (ADMIN se conserva a nivel técnico,
  // ver lib/projects/access.ts). MIEMBRO y OBSERVADOR no llegan aquí.
  const { userId, supabase } = await requireProjectRole(parsed.data.projectId, MANAGER_ROLES);

  const refError = await validateTaskRefs(
    supabase,
    parsed.data.projectId,
    parsed.data.areaId,
    parsed.data.assigneeId
  );
  if (refError) return { error: refError };

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
      progress: resolveProgress(parsed.data.status, parsed.data.progress),
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
  if (!projectId || !taskId) return { error: "Datos inválidos." };

  // PROPIETARIO (y ADMIN, técnico) edita cualquier campo de cualquier tarea.
  // MIEMBRO solo puede tocar estado/progreso/fecha límite, y solo en una
  // tarea que tenga asignada: se bifurca aquí, no confiando en qué campos
  // llegaron en el formulario (un MIEMBRO podría enviar cualquier cosa
  // manipulando la petición).
  const { userId, role, supabase } = await requireProjectRole(projectId, [
    ...MANAGER_ROLES,
    "MEMBER",
  ]);

  if (MANAGER_ROLES.includes(role)) {
    return updateTaskAsManager({ projectId, taskId, userId, supabase, formData });
  }

  return updateTaskAsMember({ projectId, taskId, userId, supabase, formData });
}

async function updateTaskAsManager(params: {
  projectId: string;
  taskId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof requireProjectRole>>["supabase"];
  formData: FormData;
}): Promise<ActionState> {
  const { projectId, taskId, userId, supabase, formData } = params;

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

  const { taskId: id, assigneeId, ...rest } = parsed.data;

  const refError = await validateTaskRefs(supabase, projectId, rest.areaId, assigneeId);
  if (refError) return { error: refError };

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
      progress: resolveProgress(rest.status ?? "TODO", rest.progress ?? 0),
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

async function updateTaskAsMember(params: {
  projectId: string;
  taskId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof requireProjectRole>>["supabase"];
  formData: FormData;
}): Promise<ActionState> {
  const { projectId, taskId, userId, supabase, formData } = params;

  const { data: assignment } = await supabase
    .from("task_assignments")
    .select("user_id")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!assignment) {
    return { error: "Solo puedes modificar tareas que tengas asignadas." };
  }

  const parsed = updateTaskAsMemberSchema.safeParse({
    taskId,
    status: formData.get("status"),
    progress: formData.get("progress") || 0,
    dueDate: formData.get("dueDate") || null,
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: parsed.data.status,
      progress: resolveProgress(parsed.data.status, parsed.data.progress),
      due_date: parsed.data.dueDate,
    })
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) {
    return { error: error.message };
  }

  await logActivity(supabase, {
    projectId,
    userId,
    action: "task.updated",
    entityType: "task",
    entityId: taskId,
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
  const { userId, role, supabase } = await requireProjectRole(params.projectId, EDITOR_ROLES);

  if (!MANAGER_ROLES.includes(role)) {
    const { data: assignment } = await supabase
      .from("task_assignments")
      .select("user_id")
      .eq("task_id", params.taskId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!assignment) {
      throw new Error("Solo puedes mover tareas que tengas asignadas.");
    }
  }

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
