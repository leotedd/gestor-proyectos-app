"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRole, EDITOR_ROLES, MANAGER_ROLES } from "@/lib/projects/access";
import { logActivity } from "@/lib/activity";
import { DOCUMENTS_BUCKET } from "@/lib/documents/shared";

export type ActionState = { error?: string; success?: string } | null;

/**
 * El archivo ya se subió a Storage desde el cliente (RLS valida el rol al
 * insertar en storage.objects); aquí solo registramos el metadato.
 */
export async function recordAttachmentAction(params: {
  projectId: string;
  taskId?: string | null;
  fileName: string;
  storagePath: string;
  mimeType: string;
  size: number;
}): Promise<ActionState> {
  const { userId, supabase } = await requireProjectRole(params.projectId, EDITOR_ROLES);

  const { error } = await supabase.from("attachments").insert({
    project_id: params.projectId,
    task_id: params.taskId ?? null,
    uploaded_by: userId,
    file_name: params.fileName,
    storage_path: params.storagePath,
    mime_type: params.mimeType,
    size: params.size,
  });

  if (error) return { error: error.message };

  await logActivity(supabase, {
    projectId: params.projectId,
    userId,
    action: "attachment.added",
    entityType: "attachment",
    metadata: { fileName: params.fileName },
  });

  revalidatePath(`/projects/${params.projectId}/documents`);
  return { success: "Documento cargado." };
}

export async function getSignedDownloadUrlAction(
  storagePath: string,
  projectId: string
): Promise<{ url?: string; error?: string }> {
  const { supabase } = await requireProjectRole(projectId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error || !data) return { error: error?.message ?? "No se pudo generar el enlace." };
  return { url: data.signedUrl };
}

export async function deleteAttachmentAction(
  attachmentId: string,
  storagePath: string,
  projectId: string
) {
  const { userId, supabase } = await requireProjectRole(projectId, MANAGER_ROLES);

  await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

  const { error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    projectId,
    userId,
    action: "attachment.deleted",
    entityType: "attachment",
    entityId: attachmentId,
  });

  revalidatePath(`/projects/${projectId}/documents`);
}
