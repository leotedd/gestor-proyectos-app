// Constantes y helpers de Storage sin dependencias de servidor: se importan
// tanto desde Server Actions/Server Components como desde Client Components
// (el formulario de carga sube el archivo directamente desde el navegador).

export const DOCUMENTS_BUCKET = "project-documents";

export function buildStoragePath(projectId: string, fileName: string, taskId?: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  return taskId
    ? `projects/${projectId}/tasks/${taskId}/${unique}`
    : `projects/${projectId}/general/${unique}`;
}
