"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { recordAttachmentAction } from "@/app/actions/documents";
import { DOCUMENTS_BUCKET, buildStoragePath } from "@/lib/documents/shared";

export function UploadDocumentForm({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      const supabase = createClient();
      const path = buildStoragePath(projectId, file.name);

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type || undefined });

      if (uploadError) throw new Error(uploadError.message);

      const result = await recordAttachmentAction({
        projectId,
        fileName: file.name,
        storagePath: path,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });

      if (result?.error) throw new Error(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el documento.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
      <Button onClick={() => inputRef.current?.click()} loading={uploading} size="sm">
        <Upload className="h-4 w-4" /> Subir documento
      </Button>
    </div>
  );
}
