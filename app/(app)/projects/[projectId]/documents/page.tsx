import { getProjectContext } from "@/lib/projects/access";
import { listProjectAttachments } from "@/lib/documents/queries";
import { DocumentsList } from "@/components/documents/documents-list";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";

export const metadata = { title: "Documentos" };

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [{ canEdit, canManage, userId }, attachments] = await Promise.all([
    getProjectContext(projectId),
    listProjectAttachments(projectId),
  ]);

  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Documentos y evidencias</h2>
          <p className="text-sm text-muted-foreground">
            Archivos privados del proyecto, almacenados de forma segura.
          </p>
        </div>
        {canEdit && <UploadDocumentForm projectId={projectId} />}
      </div>

      <DocumentsList
        projectId={projectId}
        attachments={attachments}
        canManage={canManage}
        currentUserId={userId}
      />
    </div>
  );
}
