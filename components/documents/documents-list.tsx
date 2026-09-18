"use client";

import { useState } from "react";
import { FileText, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/utils";
import { getSignedDownloadUrlAction, deleteAttachmentAction } from "@/app/actions/documents";
import type { AttachmentWithUploader } from "@/lib/documents/queries";

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsList({
  projectId,
  attachments,
  canManage,
}: {
  projectId: string;
  attachments: AttachmentWithUploader[];
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function handleDownload(path: string) {
    const res = await getSignedDownloadUrlAction(path, projectId);
    if (res.error || !res.url) {
      setError(res.error ?? "No se pudo generar el enlace.");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(attachment: AttachmentWithUploader) {
    const ok = await confirm({
      title: `Eliminar "${attachment.file_name}"`,
      description: "El archivo se eliminará permanentemente del almacenamiento.",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAttachmentAction(attachment.id, attachment.storage_path, projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el documento.");
    }
  }

  if (attachments.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin documentos todavía"
        description="Sube evidencias, actas o archivos de referencia del proyecto."
      />
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="rounded-xl border border-border bg-surface divide-y divide-border">
        {attachments.map((doc) => (
          <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatSize(doc.size)} · Subido por {doc.uploader?.full_name || doc.uploader?.email || "—"} ·{" "}
                {formatDateTime(doc.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Descargar"
                onClick={() => handleDownload(doc.storage_path)}
              >
                <Download className="h-4 w-4" />
              </Button>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-danger hover:bg-red-50"
                  aria-label="Eliminar"
                  onClick={() => handleDelete(doc)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {dialog}
    </div>
  );
}
