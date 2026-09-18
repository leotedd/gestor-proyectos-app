"use client";

import { useState } from "react";
import { Pencil, Trash2, FolderKanban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { AreaFormModal } from "@/components/areas/area-form-modal";
import { deleteAreaAction } from "@/app/actions/areas";
import type { AreaRow } from "@/lib/types/database";

export function AreasList({
  projectId,
  areas,
  canManage,
  taskCounts,
}: {
  projectId: string;
  areas: AreaRow[];
  canManage: boolean;
  taskCounts: Record<string, number>;
}) {
  const [editing, setEditing] = useState<AreaRow | null>(null);
  const { confirm, dialog } = useConfirm();

  async function handleDelete(area: AreaRow) {
    const ok = await confirm({
      title: `Eliminar "${area.name}"`,
      description: "Las tareas asociadas quedarán sin área asignada.",
      danger: true,
    });
    if (!ok) return;
    await deleteAreaAction(area.id, projectId);
  }

  if (areas.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Sin áreas todavía"
        description="Organiza a tu equipo creando áreas como Desarrollo, QA o Diseño."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {areas.map((area) => (
          <Card key={area.id} className="p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground">{area.name}</h3>
              {canManage && (
                <div className="flex items-center gap-1 -mt-1 -mr-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(area)} aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:bg-red-50"
                    onClick={() => handleDelete(area)}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {area.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{area.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-auto pt-2">
              {taskCounts[area.id] ?? 0} tarea{(taskCounts[area.id] ?? 0) !== 1 ? "s" : ""}
            </p>
          </Card>
        ))}
      </div>

      {editing && (
        <AreaFormModal
          projectId={projectId}
          area={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
      {dialog}
    </>
  );
}
