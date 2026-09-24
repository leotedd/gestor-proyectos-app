import { z } from "zod";

export const taskLinkScopeSchema = z.object({
  projectId: z.uuid("Proyecto inválido."),
  taskId: z.uuid("Tarea inválida."),
});

export const taskLinkUrlSchema = z.string().trim().min(1).max(2048)
  .refine((value) => {
    if (!/^https?:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return false;
    try {
      const url = new URL(value);
      return !!url.hostname && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Usa una URL completa http:// o https://, sin espacios ni credenciales.");

export const createTaskLinkSchema = taskLinkScopeSchema.extend({
  title: z.string().trim().min(1, "Escribe un nombre para el enlace.").max(200),
  url: taskLinkUrlSchema,
});
export const deleteTaskLinkSchema = taskLinkScopeSchema.extend({
  linkId: z.uuid("Enlace inválido."),
});
export const updateTaskLinkSchema = createTaskLinkSchema.extend({
  linkId: z.uuid("Enlace inválido."),
});

export interface TaskLink {
  id: string;
  task_id: string;
  title: string;
  url: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
