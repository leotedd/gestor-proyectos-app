"use client";

import { useState, useTransition } from "react";
import { Archive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { archiveProjectAction, restoreProjectAction } from "@/app/actions/projects";

export function ArchiveProjectButton({
  projectId,
  archived,
}: {
  projectId: string;
  archived: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function handleClick() {
    if (!archived) {
      const ok = await confirm({
        title: "Archivar proyecto",
        description: "El proyecto pasará a estado archivado y no aparecerá como activo.",
        danger: true,
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const action = archived ? restoreProjectAction : archiveProjectAction;
      const res = await action(projectId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <Button variant={archived ? "outline" : "danger"} onClick={handleClick}>
        {archived ? <RefreshCw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        {archived ? "Restaurar proyecto" : "Archivar proyecto"}
      </Button>
      {dialog}
    </div>
  );
}
