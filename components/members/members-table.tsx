"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import {
  changeMemberRoleAction,
  removeMemberAction,
  updateMemberAreaAction,
} from "@/app/actions/members";
import type { ProjectRole, AreaRow } from "@/lib/types/database";

export interface MemberStat {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  areaId: string | null;
  isGuest: boolean;
  assigned: number;
  completed: number;
  pending: number;
  completionPct: number;
}

export function MembersTable({
  projectId,
  members,
  areas,
  canManage,
}: {
  projectId: string;
  members: MemberStat[];
  areas: AreaRow[];
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  function handleRoleChange(memberId: string, role: ProjectRole) {
    startTransition(async () => {
      const res = await changeMemberRoleAction(memberId, projectId, role);
      if (res?.error) setError(res.error);
    });
  }

  function handleAreaChange(memberId: string, areaId: string) {
    startTransition(async () => {
      const res = await updateMemberAreaAction(memberId, projectId, areaId || null);
      if (res?.error) setError(res.error);
    });
  }

  async function handleRemove(memberId: string, name: string) {
    const ok = await confirm({
      title: "Quitar miembro",
      description: `${name} perderá el acceso a este proyecto.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await removeMemberAction(memberId, projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar al miembro.");
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Miembro</th>
              <th className="px-4 py-2.5 font-medium">Área</th>
              <th className="px-4 py-2.5 font-medium">Rol</th>
              <th className="px-4 py-2.5 font-medium text-center">Asignadas</th>
              <th className="px-4 py-2.5 font-medium text-center">Completadas</th>
              <th className="px-4 py-2.5 font-medium text-center">Pendientes</th>
              <th className="px-4 py-2.5 font-medium">Cumplimiento</th>
              {canManage && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={m.name} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate flex items-center gap-1.5">
                        {m.name}
                        {m.isGuest && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Invitado
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {canManage && m.role !== "OWNER" ? (
                    <Select
                      value={m.areaId ?? ""}
                      onChange={(e) => handleAreaChange(m.id, e.target.value)}
                      className="h-8 text-xs"
                    >
                      <option value="">Sin área</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">
                      {areas.find((a) => a.id === m.areaId)?.name ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {canManage && m.role !== "OWNER" ? (
                    <Select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as ProjectRole)}
                      className="h-8 text-xs"
                    >
                      <option value="ADMIN">Administrador</option>
                      <option value="MEMBER">Miembro</option>
                      <option value="VIEWER">Observador</option>
                    </Select>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">{m.assigned}</td>
                <td className="px-4 py-2.5 text-center text-success font-medium">{m.completed}</td>
                <td className="px-4 py-2.5 text-center">{m.pending}</td>
                <td className="px-4 py-2.5 w-32">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-surface-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${m.completionPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {m.completionPct}%
                    </span>
                  </div>
                </td>
                {canManage && (
                  <td className="px-4 py-2.5">
                    {m.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger hover:bg-red-50"
                        onClick={() => handleRemove(m.id, m.name)}
                        aria-label="Quitar miembro"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  );
}
